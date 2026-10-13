-- ============================================================
-- Rollback: 293 - 참가자 알림 링크 from=vacancy 되돌리기 (291 본문 그대로)
-- 작성일: 2026-10-13
-- ============================================================

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
  v_link         TEXT;
  v_subs         INT := 0;   -- 알릴 대상(활성·미신청 알림 신청자) 수
  v_alerted      INT := 0;   -- 실제로 들어간 알림 수(242 억제분 제외)
BEGIN
  -- 「신청됨」이 사라지는 경우만: registered→cancelled 갱신, 또는 registered 행 삭제
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

  -- 정원 있는 사전 신청 클래스, 아직 시작 전일 때만
  IF v_program_id IS NULL OR v_capacity IS NULL OR v_signup_mode <> 'rsvp' THEN RETURN NULL; END IF;
  IF v_starts_at <= now() THEN RETURN NULL; END IF;

  -- 이 취소가 반영된 지금 신청 인원. 취소 직전에 꽉 차 있었고 지금 딱 한 자리 비는 순간만.
  SELECT count(*) INTO v_count
  FROM public.session_registrations r
  WHERE r.session_id = OLD.session_id AND r.status = 'registered';
  IF v_count <> v_capacity - 1 THEN RETURN NULL; END IF;

  -- 「10/15(수) 19:00」 — KST 기준
  v_local := v_starts_at AT TIME ZONE 'Asia/Seoul';
  v_when  := to_char(v_local, 'MM/DD')
           || '(' || (ARRAY['일','월','화','수','목','금','토'])[EXTRACT(DOW FROM v_local)::int + 1] || ') '
           || to_char(v_local, 'HH24:MI');
  v_link  := '/programs/' || v_program_id::text || '?tab=classes&class=' || OLD.session_id::text;

  -- (a) 「빈자리 나면 알림 받기」를 누른 참가자 — 아직 활성이고, 이 세션에 신청돼 있지 않은 사람만
  --     actor_id = 취소한 사람 → 242 dedup: 같은 사람의 반복 취소는 6시간에 1건
  SELECT count(*) INTO v_subs
  FROM public.session_vacancy_alerts a
  JOIN public.program_participants pp
    ON pp.program_id = v_program_id AND pp.user_id = a.user_id AND pp.status = 'ACTIVE'
  WHERE a.session_id = OLD.session_id
    AND a.user_id <> OLD.user_id
    AND NOT EXISTS (SELECT 1 FROM public.session_registrations r
                    WHERE r.session_id = OLD.session_id AND r.user_id = a.user_id AND r.status = 'registered')
    AND public.is_notification_enabled(a.user_id, 'CLASS_VACANCY');

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  SELECT a.user_id,
         'CLASS_VACANCY',
         '🎫 빈자리가 생겼어요',
         v_title || ' ' || v_when || ' 에 자리가 1개 생겼어요. 선착순이에요 (신청 '
           || v_count || '/' || v_capacity || '명)',
         v_link, OLD.user_id, 'sessions', OLD.session_id
  FROM public.session_vacancy_alerts a
  JOIN public.program_participants pp
    ON pp.program_id = v_program_id AND pp.user_id = a.user_id AND pp.status = 'ACTIVE'
  WHERE a.session_id = OLD.session_id
    AND a.user_id <> OLD.user_id
    AND NOT EXISTS (SELECT 1 FROM public.session_registrations r
                    WHERE r.session_id = OLD.session_id AND r.user_id = a.user_id AND r.status = 'registered')
    AND public.is_notification_enabled(a.user_id, 'CLASS_VACANCY');
  GET DIAGNOSTICS v_alerted = ROW_COUNT;

  -- (b) 운영자 — 같은 actor 라 같은 6시간 억제를 탄다(반복 취소로 운영자도 시달리지 않게)
  SELECT p.owner_id INTO v_owner_id FROM public.programs p WHERE p.id = v_program_id;
  IF v_owner_id IS NULL OR v_owner_id = OLD.user_id THEN RETURN NULL; END IF;
  IF NOT public.is_notification_enabled(v_owner_id, 'CLASS_VACANCY') THEN RETURN NULL; END IF;

  SELECT u.nickname INTO v_nickname FROM public.users u WHERE u.id = OLD.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_owner_id,
    'CLASS_VACANCY',
    '🎫 클래스 빈자리',
    v_title || ' ' || v_when || ' · ' || COALESCE(v_nickname, '(?)') || '님이 취소해 1자리 비었어요 (신청 '
      || v_count || '/' || v_capacity || '명) · '
      || CASE WHEN v_subs = 0 THEN '알림 신청자 없음'
              WHEN v_alerted = v_subs THEN '알림 신청자 ' || v_subs || '명에게 알렸어요'
              ELSE '알림 신청자 ' || v_subs || '명 (' || (v_subs - v_alerted) || '명은 최근에 이미 알려 생략)' END,
    v_link,
    OLD.user_id,
    'sessions',
    OLD.session_id
  );

  RETURN NULL;
END;
$$;
