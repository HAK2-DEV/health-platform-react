-- ============================================================
-- Migration: 042 - 운영자 알림 트리거 2종 추가
-- 작성일: 2026-05-25
-- 설명: 040/041 에서 누락된 운영자 앞단 알림 보완.
--   본인 피드백: "새 참여자가 들어왔는데 운영자에게 알람 안뜸 / 활동 인증해도 안뜸"
--   원인: 041 트리거 3종은 모두 참여자 앞단만 커버.
--         운영자는 누가 가입했는지 / 무엇이 인증되는지 모름.
--
-- 새 type:
--   PARTICIPANT_JOINED     — 참여자 가입 (FREE/INVITE → ACTIVE, APPROVAL → PENDING)
--   VERIFICATION_SUBMITTED — 인증 제출 (AUTO 자동승인 + MANUAL 심사대기 모두)
--
-- 새 트리거:
--   4) notify_on_participant_join
--      program_participants INSERT
--      → program.owner_id 에게 알림 (단, 본인 프로그램에 본인이 참여하면 알림 X)
--      link_path: APPROVAL+PENDING → /programs/:id/stats/users
--                 그 외             → /programs/:id/stats/users
--
--   5) notify_on_verification_submitted
--      verifications INSERT (BEFORE 트리거 018 이 status 확정 후 AFTER 에서 실행)
--      → program.owner_id 에게 알림 (단, 운영자 본인 인증은 알림 X)
--      link_path: MANUAL → /programs/:id/reviews
--                 AUTO   → /programs/:id/stats/users/:user_id/verifications
--
-- 복구:
--   supabase/rollbacks/042_revert_operator_notifications.sql 수동 실행.
-- ============================================================

-- ─── 0) notifications.type CHECK 확장 ──────────────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'REVIEW_APPROVED', 'REVIEW_REJECTED', 'POST_LIKE', 'POST_COMMENT',
    'PARTICIPANT_JOINED', 'VERIFICATION_SUBMITTED'
  ));


-- ─── 4) 참여자 가입 알림 → 운영자 ─────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_participant_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_program_name TEXT;
  v_join_type TEXT;
  v_actor_nickname TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  SELECT p.owner_id, p.name, p.join_type
  INTO v_owner_id, v_program_name, v_join_type
  FROM public.programs p
  WHERE p.id = NEW.program_id;

  -- 운영자 자신이 본인 프로그램 가입 / 소유자 없음 → 알림 X
  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;

  -- APPROVAL + PENDING → 승인 요청
  IF v_join_type = 'APPROVAL' AND NEW.status = 'PENDING' THEN
    v_title := '🙋 가입 승인 요청';
    v_body := COALESCE(v_actor_nickname, '(?)') || '님이 ' || v_program_name || ' 가입을 요청했어요';
  ELSE
    v_title := '👋 새 참여자';
    v_body := COALESCE(v_actor_nickname, '(?)') || '님이 ' || v_program_name || ' 에 참여했어요';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_owner_id,
    'PARTICIPANT_JOINED',
    v_title,
    v_body,
    '/programs/' || NEW.program_id::text || '/stats/users',
    NEW.user_id,
    'program_participants',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_join_on_participants ON public.program_participants;
CREATE TRIGGER notify_join_on_participants
AFTER INSERT ON public.program_participants
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_participant_join();


-- ─── 5) 인증 제출 알림 → 운영자 ────────────────────────────
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
  -- 018 BEFORE 트리거가 status 를 이미 확정 (AUTO → APPROVED, MANUAL → PENDING_REVIEW)
  SELECT m.title, m.program_id, p.name, p.owner_id
  INTO v_mission_title, v_program_id, v_program_name, v_owner_id
  FROM public.missions m
  JOIN public.programs p ON p.id = m.program_id
  WHERE m.id = NEW.mission_id;

  -- 운영자 자신이 본인 프로그램에 인증 / 소유자 없음 → 알림 X
  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;

  IF NEW.status = 'PENDING_REVIEW' THEN
    v_title := '📝 심사 요청';
    v_body := COALESCE(v_actor_nickname, '(?)') || '님 — ' || v_mission_title || ' (' || v_program_name || ')';
    v_link_path := '/programs/' || v_program_id::text || '/reviews';
  ELSE
    -- APPROVED (AUTO 자동승인) 또는 그 외
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

DROP TRIGGER IF EXISTS notify_submit_on_verifications ON public.verifications;
CREATE TRIGGER notify_submit_on_verifications
AFTER INSERT ON public.verifications
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_verification_submitted();
