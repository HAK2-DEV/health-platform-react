-- ============================================================
-- Rollback: 058 - 041 review 본문 시점으로 복원 (자기 알림 가드 제거)
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_on_verification_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission_title TEXT;
  v_program_id UUID;
  v_program_name TEXT;
  v_point INT;
BEGIN
  IF OLD.status != 'PENDING_REVIEW' THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('APPROVED', 'REJECTED') THEN RETURN NEW; END IF;

  SELECT m.title, m.program_id, m.point, p.name
  INTO v_mission_title, v_program_id, v_point, v_program_name
  FROM public.missions m
  JOIN public.programs p ON p.id = m.program_id
  WHERE m.id = NEW.mission_id;

  IF NEW.status = 'APPROVED' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
    VALUES (
      NEW.user_id, 'REVIEW_APPROVED', '✅ 인증이 승인됐어요',
      v_mission_title || ' — +' || v_point || 'P 획득 (' || v_program_name || ')',
      '/programs/' || v_program_id::text, 'verifications', NEW.id
    );
  ELSIF NEW.status = 'REJECTED' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
    VALUES (
      NEW.user_id, 'REVIEW_REJECTED', '❌ 인증이 반려됐어요',
      v_mission_title || COALESCE(' — ' || NEW.rejection_reason, '') || ' (' || v_program_name || ')',
      '/programs/' || v_program_id::text, 'verifications', NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;
