-- ============================================================
-- ROLLBACK: 031 - 자동 생성 미션 트리거 복원
-- 작성일: 2026-05-22
-- 짝: supabase/migrations/20260522_031_drop_auto_mission_trigger.sql
--
-- ⚠️ 이 파일은 supabase CLI 의 자동 마이그레이션 흐름에 포함되지 않음.
--    rollbacks/ 폴더에 위치 — 본인이 의도적으로 필요할 때만 수동 실행.
--
-- 실행 방법:
--   psql 또는 Supabase Dashboard SQL Editor 에 이 파일 내용 그대로 붙여넣기.
--   다음 효과:
--     1) apply_missions_from_program(UUID) 공통 로직 함수 복원
--     2) create_missions_on_publish() 트리거 함수 복원
--     3) programs 의 INSERT/UPDATE OF status 트리거 재등록
--     4) 기존에 PUBLISHED 인 프로그램에 대해 missions 백필
--
-- 본 스크립트는 017 마이그레이션의 본문과 동일.
--   017 (supabase/migrations/20260520_017_missions_trigger.sql) 를 참고.
-- ============================================================

-- 1) 공통 로직 함수
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
      v_program.start_date::timestamptz,
      v_program.end_date::timestamptz
    )
    ON CONFLICT (program_id, feature) DO NOTHING;
  END LOOP;
END;
$$;


-- 2) 트리거 함수: PUBLISHED 진입 시점
CREATE OR REPLACE FUNCTION public.create_missions_on_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status != 'PUBLISHED' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'PUBLISHED' THEN
    RETURN NEW;
  END IF;

  PERFORM public.apply_missions_from_program(NEW.id);

  RETURN NEW;
END;
$$;


-- 3) 트리거 등록
DROP TRIGGER IF EXISTS create_missions_on_program_publish ON public.programs;
CREATE TRIGGER create_missions_on_program_publish
AFTER INSERT OR UPDATE OF status ON public.programs
FOR EACH ROW
EXECUTE FUNCTION public.create_missions_on_publish();


-- 4) 백필: 이미 PUBLISHED 인 프로그램에 missions 생성
DO $$
DECLARE
  v_program_id UUID;
BEGIN
  FOR v_program_id IN
    SELECT id FROM public.programs WHERE status = 'PUBLISHED'
  LOOP
    PERFORM public.apply_missions_from_program(v_program_id);
  END LOOP;
END $$;
