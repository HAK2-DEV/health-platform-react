-- ============================================================
-- Rollback: 290 - 「빈자리 알림 받기」 되돌리기
-- 작성일: 2026-10-13
--   자동 해제 트리거·함수와 알림 신청 테이블을 지우고,
--   notify_on_session_vacancy() 를 289 본문(운영자 알림만)으로 되돌린다.
--   CLASS_VACANCY 타입·운영자 알림(289)은 그대로 남는다.
-- ============================================================

DROP TRIGGER IF EXISTS session_reg_clear_vacancy_trg ON public.session_registrations;
DROP FUNCTION IF EXISTS public._clear_vacancy_alert_on_register();

DROP TABLE IF EXISTS public.session_vacancy_alerts;

-- 289 본문 그대로
CREATE OR REPLACE FUNCTION public.notify_on_session_vacancy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program_id   UUID;
  v_title        TEXT;
  v_capacity     INT;
  v_signup_mode  TEXT;
  v_starts_at    TIMESTAMPTZ;
  v_count        INT;
  v_owner_id     UUID;
  v_nickname     TEXT;
  v_local        TIMESTAMP;
  v_when         TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT (OLD.status = 'registered' AND NEW.status = 'cancelled') THEN RETURN NULL; END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'registered' THEN RETURN NULL; END IF;
  ELSE
    RETURN NULL;
  END IF;

  SELECT s.program_id, s.title, s.capacity, s.signup_mode, s.starts_at
    INTO v_program_id, v_title, v_capacity, v_signup_mode, v_starts_at
  FROM public.sessions s
  WHERE s.id = OLD.session_id;

  IF v_program_id IS NULL OR v_capacity IS NULL OR v_signup_mode <> 'rsvp' THEN RETURN NULL; END IF;
  IF v_starts_at <= now() THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_count
  FROM public.session_registrations r
  WHERE r.session_id = OLD.session_id AND r.status = 'registered';
  IF v_count <> v_capacity - 1 THEN RETURN NULL; END IF;

  SELECT p.owner_id INTO v_owner_id FROM public.programs p WHERE p.id = v_program_id;
  IF v_owner_id IS NULL OR v_owner_id = OLD.user_id THEN RETURN NULL; END IF;
  IF NOT public.is_notification_enabled(v_owner_id, 'CLASS_VACANCY') THEN RETURN NULL; END IF;

  SELECT u.nickname INTO v_nickname FROM public.users u WHERE u.id = OLD.user_id;

  v_local := v_starts_at AT TIME ZONE 'Asia/Seoul';
  v_when  := to_char(v_local, 'MM/DD')
           || '(' || (ARRAY['일','월','화','수','목','금','토'])[EXTRACT(DOW FROM v_local)::int + 1] || ') '
           || to_char(v_local, 'HH24:MI');

  INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
  VALUES (
    v_owner_id,
    'CLASS_VACANCY',
    '🎫 클래스 빈자리',
    v_title || ' ' || v_when || ' · ' || COALESCE(v_nickname, '(?)') || '님이 취소해 1자리 비었어요 (신청 '
      || v_count || '/' || v_capacity || '명)',
    '/programs/' || v_program_id::text || '?tab=classes&class=' || OLD.session_id::text,
    'sessions',
    OLD.session_id
  );

  RETURN NULL;
END;
$$;
