-- ============================================================
-- Migration: 111 - 새 인증 알림 link_path 개선 (드릴다운 제거)
-- 작성일: 2026-06-23
-- 설명:
--   기존 VERIFICATION_SUBMITTED 알림은 검토 화면 최상단(/reviews) 또는 참여자 인증목록
--   으로 보내, 운영자가 번들→미션→인증을 직접 드릴다운하며 어떤 미션인지 기억해야 했음.
--   개선:
--     · 검토 필요(PENDING_REVIEW) → /programs/:id?vreview=1
--         → 통합 인증 검토 큐(모든 대기 인증 한 건씩 승인/거절) 자동 오픈
--     · 자동승인(그 외) → /programs/:id/feed?v=<verification_id>
--         → 그 인증으로 직행(피드 포커스). 드릴다운 X
--
--   notify_on_verification_submitted (074) 의 link_path 두 줄만 교체. 나머지 동작 동일.
--
-- 복구: 074 의 함수 블록 재실행.
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

  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_notification_enabled(v_owner_id, 'VERIFICATION_SUBMITTED') THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;

  IF NEW.status = 'PENDING_REVIEW' THEN
    v_title := '📝 심사 요청';
    v_body := COALESCE(v_actor_nickname, '(?)') || '님 — ' || v_mission_title || ' (' || v_program_name || ')';
    v_link_path := '/programs/' || v_program_id::text || '?vreview=1';
  ELSE
    v_title := '🌱 새 인증';
    v_body := COALESCE(v_actor_nickname, '(?)') || '님 — ' || v_mission_title || ' (' || v_program_name || ')';
    v_link_path := '/programs/' || v_program_id::text || '/feed?v=' || NEW.id::text;
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
