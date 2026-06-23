-- ============================================================
-- Migration: 121 - 미션 누적 지표(거리 등) + 1회 상한 + 집계 RPC
-- 작성일: 2026-06-23
-- 설명:
--   숫자 입력 미션(requires_numeric)의 값을 누적·합산해 보여주기 위한 메타 + 안전장치.
--     · metric_unit     TEXT     — 누적 단위 표기 (km / 회 / 분 / 칼로리 ...). 범용.
--     · metric_aggregate BOOLEAN — 이 미션 numeric 을 누적 합산해서 보여줄지 (기본 false)
--     · max_per_entry    NUMERIC — 1회 입력 최대값 (부정 대비). NULL = 무제한.
--
--   1) missions 에 위 3컬럼 추가 (하위호환 — 기존 미션 metric_aggregate=false)
--   2) verifications BEFORE INSERT 트리거 — numeric_value 가 mission.max_per_entry 초과 시 거부
--      (클라 우회 방지 — 서버에서 강제)
--   3) get_metric_totals(program_id) RPC — 단위별 '함께(전체)' + '내 누적' 합산.
--      승인(APPROVED)된 값만 합산 = 무결성 경계가 곧 승인 파이프라인.
--      SECURITY DEFINER — 비피드 프로그램에서도 전체 합산 가능(개별 데이터는 노출 안 함, 합계만).
--      참여자/운영자만 호출 가능(그 외 빈 결과).
--
-- 복구:
--   DROP FUNCTION IF EXISTS public.get_metric_totals(UUID);
--   DROP TRIGGER IF EXISTS verification_max_per_entry ON public.verifications;
--   DROP FUNCTION IF EXISTS public.verification_check_max_per_entry();
--   ALTER TABLE public.missions DROP COLUMN IF EXISTS metric_unit, DROP COLUMN IF EXISTS metric_aggregate, DROP COLUMN IF EXISTS max_per_entry;
-- ============================================================

-- 1) 컬럼 추가
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS metric_unit TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS metric_aggregate BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS max_per_entry NUMERIC;

-- 2) 1회 상한 강제 트리거
CREATE OR REPLACE FUNCTION public.verification_check_max_per_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max NUMERIC;
BEGIN
  IF NEW.numeric_value IS NULL THEN RETURN NEW; END IF;
  SELECT max_per_entry INTO v_max FROM public.missions WHERE id = NEW.mission_id;
  IF v_max IS NOT NULL AND NEW.numeric_value > v_max THEN
    RAISE EXCEPTION '입력값이 1회 최대 허용(%)을 초과했어요', v_max
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS verification_max_per_entry ON public.verifications;
CREATE TRIGGER verification_max_per_entry
  BEFORE INSERT ON public.verifications
  FOR EACH ROW EXECUTE FUNCTION public.verification_check_max_per_entry();

-- 3) 단위별 누적 합산 RPC (함께 + 내 누적)
CREATE OR REPLACE FUNCTION public.get_metric_totals(p_program_id UUID)
RETURNS TABLE(unit TEXT, total NUMERIC, mine NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 참여자/운영자만
  IF NOT (
    public._is_active_participant(p_program_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = p_program_id AND p.owner_id = auth.uid())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      m.metric_unit AS unit,
      COALESCE(SUM(v.numeric_value), 0) AS total,
      COALESCE(SUM(v.numeric_value) FILTER (WHERE v.user_id = auth.uid()), 0) AS mine
    FROM public.verifications v
    JOIN public.missions m ON m.id = v.mission_id
    WHERE m.program_id = p_program_id
      AND m.metric_aggregate = true
      AND v.status = 'APPROVED'
      AND v.numeric_value IS NOT NULL
    GROUP BY m.metric_unit;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_metric_totals(UUID) TO authenticated;
