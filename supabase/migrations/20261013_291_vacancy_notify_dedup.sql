-- ============================================================
-- Migration: 291 - 빈자리 알림 반복 억제 — 같은 사람이 같은 클래스에서 취소를 반복해도 6시간에 1건
-- 작성일: 2026-10-13
-- 설명:
--   290 을 프로드에서 실측하니(「1」 프로그램, 10-13 23:04) 신청→취소를 반복할 때마다
--   알림 신청자·운영자에게 알림이 «매번» 나갔다(3번 취소 → 각 3건). 상한이 없어 실수든
--   장난이든 알림 폭탄이 된다.
--
--   해결: 두 알림 모두 actor_id = 취소한 사람(OLD.user_id) 을 넣는다.
--     → 242 의 _notif_dedup(BEFORE INSERT) 이 «같은 수신자·같은 type·같은 actor·같은 ref 를
--       6시간 안에 또 넣으면 스킵» 하므로, 같은 사람의 반복 취소는 수신자마다 6시간에 1건.
--     · 다른 사람이 취소하면(actor 가 다름) 정상적으로 다시 알린다 — 진짜 새 빈자리.
--     · 289/290 에서 actor 를 일부러 뺐던 이유(「같은 사람의 두 번째 취소도 알려야」)는
--       실측 결과 득보다 실이 커서 뒤집는다.
--   덤: 263 의 차단 스킵도 적용 — 차단한 사람의 취소로는 알림이 안 온다(드물고 무해).
--
--   운영자 본문의 인원 표기도 정직하게: 「알림 신청자 N명에게 알렸어요」 /
--   일부가 6시간 억제에 걸리면 「알림 신청자 N명 (M명은 최근에 이미 알려 생략)」 / 없으면 「알림 신청자 없음」.
--   (INSERT … SELECT 의 ROW_COUNT 는 BEFORE 트리거가 스킵한 행을 세지 않는다 → 실제 보낸 수.)
--
-- 영향: CREATE OR REPLACE public.notify_on_session_vacancy() 만. 테이블·트리거 변경 없음.
-- 하위호환: 알림 행에 actor_id 가 생길 뿐 — 프론트는 actor 를 쓰지 않는다(차단 필터만).
-- 복구: supabase/rollbacks/291_revert_vacancy_notify_dedup.sql (290 본문으로)
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
