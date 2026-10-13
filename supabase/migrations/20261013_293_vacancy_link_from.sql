-- ============================================================
-- Migration: 293 - 참가자 빈자리 알림 링크에 from=vacancy 표시 — 늦게 들어와 이미 찼을 때 한 줄 안내용
-- 작성일: 2026-10-13
-- 설명:
--   본인 결정(10-13): 「🎫 빈자리가 생겼어요」 알림을 누르고 들어왔는데 다른 사람이 먼저 신청해
--   다시 마감이면, 화면이 그냥 「마감」이라 알림이 잘못 온 줄 안다. 알림 링크에 from=vacancy 를
--   붙여 화면이 「아쉽게도 방금 자리가 찼어요 · 알림은 켜 둔 채라 다음 빈자리도 알려드릴게요」
--   한 줄을 보여 준다. 운영자 알림 링크는 그대로.
--   «순서 보장»(먼저 온 사람에게 자리를 잠시 잡아 두기)은 지금 규모에 과해서 안 한다.
--
-- 영향: CREATE OR REPLACE public.notify_on_session_vacancy() — 참가자 알림 link_path 끝에 '&from=vacancy' 만 추가.
--   판정·억제(291)·문구 모두 그대로.
-- 하위호환: 구버전 프론트는 모르는 쿼리 파라미터를 무시한다(클래스 상세는 그대로 열림).
-- 복구: supabase/rollbacks/293_revert_vacancy_link_from.sql (291 본문으로)
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
  --     링크 끝 from=vacancy → 들어왔을 때 이미 찼으면 화면이 한 줄 안내(293)
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
         v_link || '&from=vacancy', OLD.user_id, 'sessions', OLD.session_id
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
