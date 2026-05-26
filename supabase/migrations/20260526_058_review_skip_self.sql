-- ============================================================
-- Migration: 058 - 041 review 알림 자기 알림 방지 가드
-- 작성일: 2026-05-26
-- 설명: 041 의 notify_on_verification_review 트리거가 NEW.user_id (인증 작성자) 에게
--   심사 결과 알림 INSERT. 그런데 운영자 본인이 자기 MANUAL 인증을 본인이 심사하는 경우
--   (테스트/시범) NEW.user_id == NEW.reviewer_id 라서 자기 자신에게 알림이 감.
--
-- 해결: NEW.user_id = NEW.reviewer_id 면 알림 INSERT 스킵.
--   (042 submission 트리거의 owner==user 가드와 같은 패턴)
--
-- 복구:
--   supabase/rollbacks/058_revert_review_skip_self.sql 수동 실행 → 041 시점 본문 복원.
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
  -- PENDING_REVIEW → APPROVED/REJECTED 만 처리
  IF OLD.status != 'PENDING_REVIEW' THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('APPROVED', 'REJECTED') THEN RETURN NEW; END IF;

  -- 자기 인증을 자기가 심사 → 알림 X (운영자 본인 테스트 시나리오)
  IF NEW.reviewer_id IS NOT NULL AND NEW.reviewer_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT m.title, m.program_id, m.point, p.name
  INTO v_mission_title, v_program_id, v_point, v_program_name
  FROM public.missions m
  JOIN public.programs p ON p.id = m.program_id
  WHERE m.id = NEW.mission_id;

  IF NEW.status = 'APPROVED' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
    VALUES (
      NEW.user_id,
      'REVIEW_APPROVED',
      '✅ 인증이 승인됐어요',
      v_mission_title || ' — +' || v_point || 'P 획득 (' || v_program_name || ')',
      '/programs/' || v_program_id::text,
      'verifications',
      NEW.id
    );
  ELSIF NEW.status = 'REJECTED' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
    VALUES (
      NEW.user_id,
      'REVIEW_REJECTED',
      '❌ 인증이 반려됐어요',
      v_mission_title || COALESCE(' — ' || NEW.rejection_reason, '') || ' (' || v_program_name || ')',
      '/programs/' || v_program_id::text,
      'verifications',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;
