-- ============================================================
-- Migration: 074 - notify_on_verification_submitted 에 preference 체크 추가
-- 작성일: 2026-06-03
-- 설명:
--   072 에서 트리거 4개에 is_notification_enabled() 체크 통합했는데
--   042 의 verification_submitted 트리거(운영자 알림)는 누락됨.
--   본인이 인증 알림 토글 끄면 "내 인증 결과(REVIEW_APPROVED/REJECTED)" 는 안 오는데
--   "운영자에게 가는 인증 제출 알림(VERIFICATION_SUBMITTED)" 은 그대로 옴 → 본 마이그레이션으로 통합.
--
--   v_owner_id 즉 운영자의 verify_enabled 가 false 면 알림 INSERT skip.
--
-- 복구:
--   supabase/rollbacks/074_revert_verification_submitted_pref.sql 수동 실행 →
--   042 재실행으로 preference 체크 없는 원본 함수로 복원.
-- ============================================================

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

  -- 운영자 자신이 본인 프로그램에 인증 / 소유자 없음 → 알림 X
  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- 074 — 운영자 환경설정 확인 (verify_enabled OFF 면 skip)
  IF NOT public.is_notification_enabled(v_owner_id, 'VERIFICATION_SUBMITTED') THEN
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
