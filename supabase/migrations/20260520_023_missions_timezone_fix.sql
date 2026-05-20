-- ============================================================
-- Migration: 023 - apply_missions_from_program 함수 timezone 정정
-- 작성일: 2026-05-20
-- 설명: 017 트리거 함수의 DATE → TIMESTAMPTZ 변환을 KST 자정으로 명시.
--
-- 디버깅 교훈:
--   기존: NEW.start_date::timestamptz
--     → 세션 timezone(Supabase 기본 UTC)으로 해석
--     → '2026-05-27' (DATE) → '2026-05-27 00:00 UTC' = 'KST 2026-05-27 09:00'
--     → 본인이 의도한 KST 5/27 자정보다 9시간 늦게 시작
--   정정: (start_date::text || ' 00:00:00+09:00')::timestamptz
--     → KST 자정을 명시. 어느 세션 timezone 에서도 동일하게 동작.
--
--   end_date 는 KST 23:59:59 (당일 마지막 순간) 로 — 운영 마지막 날 인증 허용.
--
-- 적용 범위:
--   본 마이그레이션은 함수만 정정. 기존 missions 행의 active_from/until 은
--   건드리지 않음 (본인의 학습/테스트 데이터 보존). 새로 PUBLISHED 되는
--   프로그램부터 정확한 KST 처리 적용.
--
--   본인의 "연습" 프로그램은 디버깅 중 임시 UPDATE 된 값(NOW()-1h ~ +30days)을
--   그대로 유지 → 본인의 인증 테스트 계속 가능.
-- ============================================================

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

    INSERT INTO public.missions (
      program_id, feature, title,
      verification_type, point, daily_limit,
      active_from, active_until
    )
    VALUES (
      v_program.id,
      v_feature_key,
      v_title,
      COALESCE(v_program.approval_mode, 'AUTO'),
      COALESCE((v_rule->>'score')::int, 0),
      (v_rule->>'daily_limit')::int,
      -- KST 자정 명시
      (v_program.start_date::text || ' 00:00:00+09:00')::timestamptz,
      -- KST 그날 23:59:59 (포괄 종료)
      (v_program.end_date::text   || ' 23:59:59+09:00')::timestamptz
    )
    ON CONFLICT (program_id, feature) DO NOTHING;
  END LOOP;
END;
$$;
