-- ============================================================
-- Migration: 025 - missions 에 requires_image, requires_numeric 메타 컬럼 추가
-- + 017 트리거 함수 진화 (자동 생성 시 메타 설정)
-- 작성일: 2026-05-20
-- 설명: (4) 통합 미션 1단계 — multi-feature 미션 기반 마련.
--
-- 컬럼:
--   requires_image   BOOLEAN DEFAULT false - 이 미션이 사진 인증 필요?
--   requires_numeric BOOLEAN DEFAULT false - 이 미션이 숫자 기록 필요?
--
-- 본 마이그레이션은 기반만 구축 — 1:1 매핑 그대로:
--   feature='image_upload'   → requires_image=true,  requires_numeric=false
--   feature='numeric_record' → requires_image=false, requires_numeric=true
--   다른 feature              → 둘 다 false (현재 인증 UI 없음)
--
-- 본격 묶기 모델은 4-c 단계 (별도 마이그레이션 + 마법사 진화):
--   운영자가 마법사 Step4 에서 "사진+숫자 묶기" 선택 → score_rules 에 신호 저장
--   → 트리거가 image_upload + numeric_record 둘 다 켠 경우 한 미션으로 통합
--     (requires_image=true + requires_numeric=true, feature='image_upload' 단일 행)
--
-- 기존 missions 백필:
--   image_upload   행 → requires_image=true
--   numeric_record 행 → requires_numeric=true
--   다른 행 → 기본값 false 그대로
-- ============================================================

-- 1) 컬럼 추가
ALTER TABLE public.missions
ADD COLUMN requires_image BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.missions
ADD COLUMN requires_numeric BOOLEAN NOT NULL DEFAULT false;

-- 2) 기존 missions 백필
UPDATE public.missions
SET requires_image = true
WHERE feature = 'image_upload';

UPDATE public.missions
SET requires_numeric = true
WHERE feature = 'numeric_record';

-- 3) 017 트리거 함수 진화 — 자동 생성 시 requires_image/numeric 설정
CREATE OR REPLACE FUNCTION public.apply_missions_from_program(p_program_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program RECORD;
  v_feature_key TEXT;
  v_rule JSONB;
  v_title TEXT;
  v_requires_image BOOLEAN;
  v_requires_numeric BOOLEAN;
BEGIN
  SELECT id, features, score_rules, approval_mode, start_date, end_date
  INTO v_program
  FROM public.programs
  WHERE id = p_program_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR v_feature_key IN
    SELECT jsonb_object_keys(COALESCE(v_program.features, '{}'::jsonb))
  LOOP
    IF NOT COALESCE((v_program.features->v_feature_key)::boolean, false) THEN
      CONTINUE;
    END IF;

    v_rule := v_program.score_rules->v_feature_key;

    v_title := CASE v_feature_key
      WHEN 'image_upload'   THEN '사진 인증'
      WHEN 'numeric_record' THEN '기록 입력'
      WHEN 'comment'        THEN '댓글 작성'
      WHEN 'like'           THEN '좋아요'
      WHEN 'quiz'           THEN '퀴즈 풀이'
      WHEN 'body_metrics'   THEN '신체 지표 입력'
      ELSE v_feature_key
    END;

    -- 1:1 매핑 (현재 모델). 본격 묶기 모델은 4-c 에서.
    v_requires_image   := (v_feature_key = 'image_upload');
    v_requires_numeric := (v_feature_key = 'numeric_record');

    INSERT INTO public.missions (
      program_id, feature, title,
      verification_type, point, daily_limit,
      requires_image, requires_numeric,
      active_from, active_until
    )
    VALUES (
      v_program.id,
      v_feature_key,
      v_title,
      COALESCE(v_program.approval_mode, 'AUTO'),
      COALESCE((v_rule->>'score')::int, 0),
      (v_rule->>'daily_limit')::int,
      v_requires_image,
      v_requires_numeric,
      (v_program.start_date::text || ' 00:00:00+09:00')::timestamptz,
      (v_program.end_date::text   || ' 23:59:59+09:00')::timestamptz
    )
    ON CONFLICT (program_id, feature) DO NOTHING;
  END LOOP;
END;
$$;
