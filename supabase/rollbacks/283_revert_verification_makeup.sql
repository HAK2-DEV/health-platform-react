-- ============================================================
-- Rollback: 283 - 만회 인증 되돌리기
-- 작성일: 2026-10-06
--   새 트리거·함수를 지우고, 바꾼 함수 3개를 원문(018·111·114)으로 되돌린다(아래 본문은 그 파일에서 그대로 잘라 붙임).
--   열(makeup_of·makeup_root·makeup_at)도 지운다 — 이미 들어간 만회 인증 행은 남고(제출 시각은 원래 날 그대로),
--   «어느 반려를 만회했는지» 연결만 사라진다.
-- ============================================================

DROP TRIGGER IF EXISTS a_verification_makeup_guard ON public.verifications;
DROP FUNCTION IF EXISTS public.verification_makeup_guard();

-- 018 원문
CREATE OR REPLACE FUNCTION public.set_verification_status_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verification_type TEXT;
BEGIN
  SELECT verification_type
  INTO v_verification_type
  FROM public.missions
  WHERE id = NEW.mission_id;

  IF v_verification_type = 'AUTO' THEN
    NEW.status := 'APPROVED';
    NEW.reviewed_at := NOW();
  ELSIF v_verification_type = 'MANUAL' THEN
    NEW.status := 'PENDING_REVIEW';
  END IF;

  RETURN NEW;
END;
$$;

-- 111 원문
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

-- 114 원문
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
  v_type TEXT;
  v_feed_enabled BOOLEAN;
  v_link TEXT;
BEGIN
  IF OLD.status != 'PENDING_REVIEW' THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('APPROVED', 'REJECTED') THEN RETURN NEW; END IF;

  v_type := CASE NEW.status WHEN 'APPROVED' THEN 'REVIEW_APPROVED' ELSE 'REVIEW_REJECTED' END;
  IF NOT public.is_notification_enabled(NEW.user_id, v_type) THEN RETURN NEW; END IF;

  SELECT m.title, m.program_id, m.point, p.name, p.feed_enabled
  INTO v_mission_title, v_program_id, v_point, v_program_name, v_feed_enabled
  FROM public.missions m
  JOIN public.programs p ON p.id = m.program_id
  WHERE m.id = NEW.mission_id;

  IF NEW.status = 'APPROVED' THEN
    v_link := CASE
      WHEN v_feed_enabled THEN '/programs/' || v_program_id::text || '/feed?v=' || NEW.id::text
      ELSE '/programs/' || v_program_id::text
    END;
    INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
    VALUES (
      NEW.user_id,
      'REVIEW_APPROVED',
      '✅ 인증이 승인됐어요',
      v_mission_title || ' — +' || v_point || 'P 획득 (' || v_program_name || ')',
      v_link,
      'verifications',
      NEW.id
    );
  ELSIF NEW.status = 'REJECTED' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
    VALUES (
      NEW.user_id,
      'REVIEW_REJECTED',
      '❌ 인증이 반려됐어요',
      v_program_name || E'\n' || v_mission_title
        || CASE WHEN btrim(COALESCE(NEW.rejection_reason, '')) <> '' THEN E'\n사유: ' || NEW.rejection_reason ELSE '' END,
      '/programs/' || v_program_id::text,
      'verifications',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP INDEX IF EXISTS public.idx_verifications_makeup_of;
DROP INDEX IF EXISTS public.idx_verifications_makeup_root;
ALTER TABLE public.verifications DROP COLUMN IF EXISTS makeup_at;
ALTER TABLE public.verifications DROP COLUMN IF EXISTS makeup_root;
ALTER TABLE public.verifications DROP COLUMN IF EXISTS makeup_of;
