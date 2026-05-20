-- ============================================================
-- Migration: 026 - programs.bundle_image_numeric + 017 트리거 진화
-- 작성일: 2026-05-20
-- 설명: (4) 통합 미션 본격 단계 — 사진+숫자 묶기 옵션.
--
-- programs.bundle_image_numeric:
--   운영자가 마법사 Step4 에서 "사진 + 숫자 한 미션으로 묶기" 선택 시 true.
--   기본 false. 기존 프로그램 영향 없음.
--
-- 트리거 동작 분기:
--   bundle_image_numeric = true AND
--   features.image_upload = true AND
--   features.numeric_record = true
--     → image_upload 행을 한 통합 미션으로 INSERT
--       (title='사진+기록 인증', requires_image=true, requires_numeric=true,
--        point = image_upload.score + numeric_record.score 합산)
--     → numeric_record 행은 INSERT 건너뜀 (UNIQUE 제약 회피)
--   그 외:
--     → 기존 1:1 매핑 (image_upload 와 numeric_record 별개 행)
--
-- 점수 합산 정책:
--   묶인 미션 1회 인증 = 둘의 점수 합. 운영자가 마법사에서 각자 점수 입력했지만
--   실제로는 한 번에 적립. 직관적이지만 추후 운영자가 헷갈릴 수 있으면 진화 필요.
-- ============================================================

-- 1) 컬럼 추가
ALTER TABLE public.programs
ADD COLUMN bundle_image_numeric BOOLEAN NOT NULL DEFAULT false;


-- 2) 017 트리거 함수 진화 — 묶기 처리
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
  v_point INT;
  v_is_image_enabled BOOLEAN;
  v_is_numeric_enabled BOOLEAN;
  v_should_bundle BOOLEAN;
BEGIN
  SELECT id, features, score_rules, approval_mode,
         start_date, end_date, bundle_image_numeric
  INTO v_program
  FROM public.programs
  WHERE id = p_program_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 묶기 가능 조건 평가
  v_is_image_enabled   := COALESCE((v_program.features->'image_upload')::boolean, false);
  v_is_numeric_enabled := COALESCE((v_program.features->'numeric_record')::boolean, false);
  v_should_bundle      := v_program.bundle_image_numeric
                          AND v_is_image_enabled
                          AND v_is_numeric_enabled;

  FOR v_feature_key IN
    SELECT jsonb_object_keys(COALESCE(v_program.features, '{}'::jsonb))
  LOOP
    IF NOT COALESCE((v_program.features->v_feature_key)::boolean, false) THEN
      CONTINUE;
    END IF;

    -- 묶기 모드: numeric_record 행은 image_upload 행에 통합되었으므로 건너뜀
    IF v_should_bundle AND v_feature_key = 'numeric_record' THEN
      CONTINUE;
    END IF;

    v_rule := v_program.score_rules->v_feature_key;

    -- 통합 미션(image_upload + numeric_record 묶음) 처리
    IF v_should_bundle AND v_feature_key = 'image_upload' THEN
      v_title := '사진+기록 인증';
      v_requires_image   := true;
      v_requires_numeric := true;
      v_point := COALESCE((v_rule->>'score')::int, 0)
               + COALESCE(((v_program.score_rules->'numeric_record')->>'score')::int, 0);
    ELSE
      v_title := CASE v_feature_key
        WHEN 'image_upload'   THEN '사진 인증'
        WHEN 'numeric_record' THEN '기록 입력'
        WHEN 'comment'        THEN '댓글 작성'
        WHEN 'like'           THEN '좋아요'
        WHEN 'quiz'           THEN '퀴즈 풀이'
        WHEN 'body_metrics'   THEN '신체 지표 입력'
        ELSE v_feature_key
      END;
      v_requires_image   := (v_feature_key = 'image_upload');
      v_requires_numeric := (v_feature_key = 'numeric_record');
      v_point := COALESCE((v_rule->>'score')::int, 0);
    END IF;

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
      v_point,
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
