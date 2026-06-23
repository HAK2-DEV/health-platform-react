-- ============================================================
-- Migration: 122 - 미션 다중 지표(거리/시간/칼로리 등) + 인증별 다중 값
-- 작성일: 2026-06-23
-- 설명:
--   숫자 입력 미션이 '여러 지표'를 받을 수 있게 확장. (러닝: 거리+운동시간+칼로리)
--     · missions.metrics       JSONB[] — 지표 정의 배열
--         [{ "key":"distance", "label":"거리", "unit":"km", "max":50, "icon":"👟" }, ...]
--     · verifications.metric_values JSONB — { "distance":5.2, "time":0.5, "calories":320 }
--   121 의 metric_aggregate 는 그대로 '개요 통계 표시' 플래그로 재사용.
--   121 의 단일 metric_unit/max_per_entry/numeric_value 는 레거시(단일 지표 미션)로 공존.
--
--   1) 컬럼 추가 (하위호환 — metrics 기본 '[]', metric_values NULL)
--   2) 1회 상한 트리거 확장 — 단일(numeric_value) + 지표별(metric_values) 둘 다 검사
--
--   ※ 다중 지표 집계(통계 카드)는 Phase 2 에서 별도 RPC 로 추가 예정.
--
-- 복구:
--   121 의 verification_check_max_per_entry() 본문 재실행.
--   ALTER TABLE public.verifications DROP COLUMN IF EXISTS metric_values;
--   ALTER TABLE public.missions DROP COLUMN IF EXISTS metrics;
-- ============================================================

-- 1) 컬럼 추가
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS metrics JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.verifications ADD COLUMN IF NOT EXISTS metric_values JSONB;

-- 2) 1회 상한 트리거 — 단일 numeric_value + 다중 metric_values 모두 검사
CREATE OR REPLACE FUNCTION public.verification_check_max_per_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max NUMERIC;
  v_metrics JSONB;
  mt JSONB;
  v_key TEXT;
  v_mmax NUMERIC;
  v_val NUMERIC;
BEGIN
  SELECT max_per_entry, metrics INTO v_max, v_metrics
  FROM public.missions WHERE id = NEW.mission_id;

  -- 레거시 단일 지표
  IF NEW.numeric_value IS NOT NULL AND v_max IS NOT NULL AND NEW.numeric_value > v_max THEN
    RAISE EXCEPTION '입력값이 1회 최대 허용(%)을 초과했어요', v_max
      USING ERRCODE = 'check_violation';
  END IF;

  -- 다중 지표 — 각 지표의 max 검사
  IF NEW.metric_values IS NOT NULL AND v_metrics IS NOT NULL AND jsonb_typeof(v_metrics) = 'array' THEN
    FOR mt IN SELECT * FROM jsonb_array_elements(v_metrics) LOOP
      v_key := mt->>'key';
      v_mmax := NULLIF(mt->>'max', '')::numeric;
      IF v_key IS NOT NULL AND v_mmax IS NOT NULL AND (NEW.metric_values ? v_key) THEN
        v_val := NULLIF(NEW.metric_values->>v_key, '')::numeric;
        IF v_val IS NOT NULL AND v_val > v_mmax THEN
          RAISE EXCEPTION '%(은)는 1회 최대 % 까지 입력할 수 있어요', COALESCE(mt->>'label', v_key), v_mmax
            USING ERRCODE = 'check_violation';
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
-- 트리거(verification_max_per_entry)는 121 에서 이미 부착됨 — CREATE OR REPLACE 로 본문만 교체.
