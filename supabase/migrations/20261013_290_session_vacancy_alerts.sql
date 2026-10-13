-- ============================================================
-- Migration: 290 - 「빈자리 알림 받기」 — 정원 마감 클래스에 참가자가 알림 신청, 자리 나면 알림
-- 작성일: 2026-10-13
-- 설명:
--   289 는 빈자리가 생기면 «운영자»에게만 알렸다. 운영자가 그걸 보고 다시 공지하는 수고를
--   없애기 위해, 참가자가 정원 마감 클래스에서 「빈자리 나면 알림 받기」를 누르면
--   자리가 생기는 순간 그 참가자들에게 직접 알림(푸시)이 간다. 전원에게 뿌리지 않고
--   «누른 사람에게만» — 76명 푸시 폭탄을 피하면서 원하는 사람은 놓치지 않게.
--
--   1) 신규 테이블 session_vacancy_alerts (session_id, user_id) — 「이 클래스 자리 나면 알려줘」 1행.
--      RLS: 본인 행 조회·등록·해제(활성 참가자만 등록), 운영자는 자기 프로그램 세션 조회(인원 표시용).
--   2) notify_on_session_vacancy() 확장(289 와 같은 판정 — 꽉 찼다가 딱 한 자리 비는 순간):
--      · 알림 신청자(활성 참가자, 이 세션에 신청돼 있지 않은 사람)에게 CLASS_VACANCY 알림
--      · 운영자 알림 본문 끝에 「알림 신청자 N명에게 알렸어요 / 신청자 없음」을 덧붙여
--        운영자가 직접 공지해야 하는지 바로 알 수 있게.
--      알림 신청 행은 지우지 않는다 — 자리를 못 잡고 다시 찼다가 또 비면 다시 알려야 하므로.
--      본인이 신청하면(아래 3) 자동으로 사라지고, 세션이 지나면 판정에서 걸러진다.
--   3) 신청(registered) 되는 순간 그 사람의 알림 신청 행을 지우는 트리거 — 자리 잡은 사람에게
--      다음 빈자리 알림이 또 가지 않게.
--
-- 영향:
--   신규 테이블 public.session_vacancy_alerts (+RLS 2정책)
--   CREATE OR REPLACE public.notify_on_session_vacancy() (289 판정·운영자 알림 유지 + 신청자 알림)
--   신규 함수 public._clear_vacancy_alert_on_register(), 트리거 session_reg_clear_vacancy_trg
--
-- 하위호환: 테이블·트리거 추가, 함수는 CREATE OR REPLACE(289 동작 포함). 구버전 프론트는
--   테이블을 모르므로 그대로 동작(운영자 알림만 받음). 코드 푸시 «전에» 적용해야 함
--   (프론트가 이 테이블을 조회하므로).
--
-- 복구:
--   supabase/rollbacks/290_revert_session_vacancy_alerts.sql (289 함수 본문으로 되돌림)
-- ============================================================

-- ── 1) 알림 신청 테이블 ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_vacancy_alerts (
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);
CREATE INDEX IF NOT EXISTS session_vacancy_alerts_user_idx ON public.session_vacancy_alerts (user_id);

ALTER TABLE public.session_vacancy_alerts ENABLE ROW LEVEL SECURITY;

-- 본인 행: 조회·등록·해제. 등록은 그 세션 프로그램의 활성 참가자만 (158 session_reg_own 과 같은 조건)
DROP POLICY IF EXISTS session_vacancy_own ON public.session_vacancy_alerts;
CREATE POLICY session_vacancy_own ON public.session_vacancy_alerts
  FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK(user_id = auth.uid()
             AND EXISTS (SELECT 1 FROM public.sessions s
                         JOIN public.program_participants pp ON pp.program_id = s.program_id
                         WHERE s.id = session_vacancy_alerts.session_id
                           AND pp.user_id = auth.uid() AND pp.status = 'ACTIVE'));

-- 운영자: 자기 프로그램 세션의 알림 신청 조회 (「알림 신청 N명」 표시용)
DROP POLICY IF EXISTS session_vacancy_owner_read ON public.session_vacancy_alerts;
CREATE POLICY session_vacancy_owner_read ON public.session_vacancy_alerts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s JOIN public.programs p ON p.id = s.program_id
                 WHERE s.id = session_vacancy_alerts.session_id AND p.owner_id = auth.uid()));

GRANT SELECT, INSERT, DELETE ON public.session_vacancy_alerts TO authenticated;

-- ── 2) 빈자리 감지 → 알림 신청자 + 운영자 알림 (289 확장) ──
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
  v_alerted      INT := 0;
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

  -- 「10/15(수) 19:00」 — KST 기준
  v_local := v_starts_at AT TIME ZONE 'Asia/Seoul';
  v_when  := to_char(v_local, 'MM/DD')
           || '(' || (ARRAY['일','월','화','수','목','금','토'])[EXTRACT(DOW FROM v_local)::int + 1] || ') '
           || to_char(v_local, 'HH24:MI');
  v_link  := '/programs/' || v_program_id::text || '?tab=classes&class=' || OLD.session_id::text;

  -- (a) 「빈자리 나면 알림 받기」를 누른 참가자 — 아직 활성이고, 이 세션에 신청돼 있지 않은 사람만
  INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
  SELECT a.user_id,
         'CLASS_VACANCY',
         '🎫 빈자리가 생겼어요',
         v_title || ' ' || v_when || ' 에 자리가 1개 생겼어요. 선착순이에요 (신청 '
           || v_count || '/' || v_capacity || '명)',
         v_link, 'sessions', OLD.session_id
  FROM public.session_vacancy_alerts a
  JOIN public.program_participants pp
    ON pp.program_id = v_program_id AND pp.user_id = a.user_id AND pp.status = 'ACTIVE'
  WHERE a.session_id = OLD.session_id
    AND a.user_id <> OLD.user_id
    AND NOT EXISTS (SELECT 1 FROM public.session_registrations r
                    WHERE r.session_id = OLD.session_id AND r.user_id = a.user_id AND r.status = 'registered')
    AND public.is_notification_enabled(a.user_id, 'CLASS_VACANCY');
  GET DIAGNOSTICS v_alerted = ROW_COUNT;

  -- (b) 운영자 — 몇 명에게 알렸는지 덧붙여, 직접 공지가 더 필요한지 바로 알게
  SELECT p.owner_id INTO v_owner_id FROM public.programs p WHERE p.id = v_program_id;
  IF v_owner_id IS NULL OR v_owner_id = OLD.user_id THEN RETURN NULL; END IF;
  IF NOT public.is_notification_enabled(v_owner_id, 'CLASS_VACANCY') THEN RETURN NULL; END IF;

  SELECT u.nickname INTO v_nickname FROM public.users u WHERE u.id = OLD.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
  VALUES (
    v_owner_id,
    'CLASS_VACANCY',
    '🎫 클래스 빈자리',
    v_title || ' ' || v_when || ' · ' || COALESCE(v_nickname, '(?)') || '님이 취소해 1자리 비었어요 (신청 '
      || v_count || '/' || v_capacity || '명) · '
      || CASE WHEN v_alerted > 0 THEN '알림 신청자 ' || v_alerted || '명에게 알렸어요'
              ELSE '알림 신청자 없음' END,
    v_link,
    'sessions',
    OLD.session_id
  );

  RETURN NULL;
END;
$$;

-- ── 3) 신청되는 순간 본인 알림 신청 행 자동 해제 ──────────
--   참가자는 session_vacancy_alerts 본인 행을 지울 수 있지만(RLS), 운영자 대리 신청 등
--   다른 경로도 같은 규칙을 타도록 SECURITY DEFINER (159 와 같은 이유).
CREATE OR REPLACE FUNCTION public._clear_vacancy_alert_on_register()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'registered' THEN
    DELETE FROM public.session_vacancy_alerts
    WHERE session_id = NEW.session_id AND user_id = NEW.user_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS session_reg_clear_vacancy_trg ON public.session_registrations;
CREATE TRIGGER session_reg_clear_vacancy_trg
  AFTER INSERT OR UPDATE OF status ON public.session_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public._clear_vacancy_alert_on_register();
