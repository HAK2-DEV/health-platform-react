-- ============================================================
-- Rollback: 074 - notify_on_verification_submitted preference 체크 제거
-- 작성일: 2026-06-03
-- 적용:
--   042 마이그레이션 (operator_notifications) 의 함수 정의를 재실행하면
--   preference 체크 없는 원본으로 복원됨.
--   즉 이 rollback 은 별도 SQL 없이 042 재실행으로 가능.
-- ============================================================

-- 042 의 원본 함수 그대로 (preference 체크 라인만 제거)
CREATE OR REPLACE FUNCTION public.notify_on_verification_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_program_id UUID;
  v_program_name TEXT;
  v_mission_title TEXT;
  v_actor_nickname TEXT;
  v_title TEXT;
  v_body TEXT;
  v_link_path TEXT;
BEGIN
  SELECT m.title, m.program_id, p.name, p.owner_id
  INTO v_mission_title, v_program_id, v_program_name, v_owner_id
  FROM public.missions m
  JOIN public.programs p ON p.id = m.program_id
  WHERE m.id = NEW.mission_id;

  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;

  IF NEW.status = 'PENDING_REVIEW' THEN
    v_title := '📝 심사 요청';
    v_body := COALESCE(v_actor_nickname, '(?)') || '님 — ' || v_mission_title || ' (' || v_program_name || ')';
    v_link_path := '/programs/' || v_program_id::text || '/reviews';
  ELSE
    v_title := '🌱 새 인증';
    v_body := COALESCE(v_actor_nickname, '(?)') || '님 — ' || v_mission_title || ' (' || v_program_name || ')';
    v_link_path := '/programs/' || v_program_id::text || '/stats/users/' || NEW.user_id::text || '/verifications';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_owner_id,
    'VERIFICATION_SUBMITTED',
    v_title,
    v_body,
    v_link_path,
    NEW.user_id,
    'verifications',
    NEW.id
  );

  RETURN NEW;
END;
$$;
