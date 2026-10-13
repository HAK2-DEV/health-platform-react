-- ============================================================
-- Migration: 289 - 정원 찼던 클래스에 빈자리 생기면 운영자 알림
-- 작성일: 2026-10-13
-- 설명:
--   문제: 사전 신청(rsvp) 클래스가 정원까지 찼다가 누군가 취소하면 아무 알림이 없어,
--         운영자가 수시로 신청 현황을 확인하고 직접 공지해야 했다(「피지컬 16」 운영자 피드백 10-13).
--   해결: session_registrations 의 신청 취소(registered → cancelled, 또는 신청됨 행 DELETE)를
--         AFTER 트리거로 잡아, «취소 직전엔 꽉 차 있었고 지금 딱 한 자리 비는 순간» 에만
--         프로그램 운영자(programs.owner_id)에게 CLASS_VACANCY 알림 1건을 넣는다.
--         → notifications INSERT 는 178/206 트리거(trg_notify_push)가 그대로 폰 푸시까지 보낸다.
--
--   알리지 않는 경우(조용히 통과):
--     · 정원 없음(capacity NULL) 또는 자유 참여(signup_mode='open')
--     · 이미 시작한 클래스(starts_at <= now()) — 빈자리를 채울 수 없음
--     · 취소 뒤 신청 인원이 capacity-1 이 아닐 때 — 원래 안 찼거나(≤ cap-2), 정원을 줄여 아직도 초과(≥ cap)
--     · 취소한 사람이 운영자 본인
--     · 운영자가 알림 선호에서 껐을 때(is_notification_enabled — 지금은 ELSE TRUE, 항상 켜짐)
--
--   참여자에게 직접 보내는 것(대기자 명단 등)은 이번 범위 밖 — 누구에게 보낼지 결정 후 별도 마이그.
--
-- 영향:
--   신규 함수 public.notify_on_session_vacancy(), 신규 트리거 session_reg_vacancy_trg
--   notifications_type_check 에 'CLASS_VACANCY' 추가 (255 목록 전부 유지)
--   actor_id 는 넣지 않는다 — 242 dedup 은 actor_id+ref_id 둘 다 있을 때만 걸려,
--   같은 사람이 6시간 안에 신청→취소를 반복해도 «실제로 생긴 빈자리» 알림이 눌리지 않게.
--
-- 하위호환: CHECK 확장(기존 값 전부 포함)·CREATE OR REPLACE·DROP TRIGGER IF EXISTS.
--   프론트는 모르는 type 이면 기본 아이콘(Bell)으로 그리므로 코드 푸시 전에 적용해도 안전.
--
-- 복구:
--   supabase/rollbacks/289_revert_class_vacancy_notify.sql
-- ============================================================

-- ── 1) 알림 타입 확장 (255 목록 + CLASS_VACANCY) ──────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'REVIEW_APPROVED', 'REVIEW_REJECTED', 'POST_LIKE', 'POST_COMMENT',
  'PARTICIPANT_JOINED', 'VERIFICATION_SUBMITTED', 'POST_PENDING',
  'POST_APPROVED', 'POST_REJECTED', 'REPORT_RECEIVED',
  'TEAM_INVITE', 'TEAM_JOINED', 'TEAM_REMOVED', 'TEAM_LEADER_CHANGED',
  'INQUIRY_RECEIVED', 'INQUIRY_ANSWERED',
  'OPERATOR_CHEER', 'CONTENT_HIDDEN',
  'NEW_MISSION', 'NEW_QUIZ', 'NEW_CLASS', 'NEW_NOTICE',
  'END_SURVEY_DUE',
  'CAPACITY_WARNING',
  'CLASS_VACANCY'
));

-- ── 2) 빈자리 감지 → 운영자 알림 ─────────────────────────
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
  --   (원래 안 찼으면 ≤ cap-2, 정원을 줄여 아직 초과면 ≥ cap → 둘 다 통과)
  SELECT count(*) INTO v_count
  FROM public.session_registrations r
  WHERE r.session_id = OLD.session_id AND r.status = 'registered';
  IF v_count <> v_capacity - 1 THEN RETURN NULL; END IF;

  SELECT p.owner_id INTO v_owner_id FROM public.programs p WHERE p.id = v_program_id;
  IF v_owner_id IS NULL OR v_owner_id = OLD.user_id THEN RETURN NULL; END IF;
  IF NOT public.is_notification_enabled(v_owner_id, 'CLASS_VACANCY') THEN RETURN NULL; END IF;

  SELECT u.nickname INTO v_nickname FROM public.users u WHERE u.id = OLD.user_id;

  -- 「10/15(수) 19:00」 — KST 기준
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

-- AFTER 트리거 — 같은 이벤트의 159 카운트 트리거(session_reg_count_trg)와 순서 무관하게
-- 이 함수는 registered 수를 직접 세므로 registered_count 에 의존하지 않는다.
DROP TRIGGER IF EXISTS session_reg_vacancy_trg ON public.session_registrations;
CREATE TRIGGER session_reg_vacancy_trg
  AFTER UPDATE OF status OR DELETE ON public.session_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_session_vacancy();
