-- ============================================================
-- Migration: 292 - 정원 찬 클래스에서 취소하면 3분 동안 재신청 금지 (cooldown)
-- 작성일: 2026-10-13
-- 설명:
--   본인 결정(10-13): 정원이 찬 클래스에서 신청을 취소할 때 화면은 확인창
--   「취소하면 다른 참가자가 자리를 가져갈 수 있어요 · 3분 뒤에 다시 신청할 수 있어요」를 띄우고,
--   서버는 3분 동안 같은 사람의 재신청을 막는다.
--   왜: 291 이 알림 폭탄은 막지만, 취소→재신청을 바로 되돌리면 알림 받은 사람이 자리를 잡기 전에
--   원점이 되는 「헛알림」이 남는다. 3분 틈을 주면 알림 받은 사람이 먼저 잡을 수 있고,
--   취소→재신청 반복 자체도 3분 간격으로 느려진다.
--   정원이 안 찬 클래스의 취소는 아무에게도 알림이 안 가므로 그대로 즉시 취소·즉시 재신청.
--
--   1) session_registrations.cooldown_until TIMESTAMPTZ (NULL = 제한 없음)
--   2) enforce_session_capacity() 확장 — 트리거는 170 그대로(BEFORE INSERT OR UPDATE OF status):
--      · registered → cancelled: 그 순간 신청 수(본인 포함) >= capacity 면 NEW.cooldown_until = now()+3분
--      · cancelled → registered(재신청 upsert 의 UPDATE 단계): 정원 검사 먼저(SESSION_FULL),
--        그다음 OLD.cooldown_until > now() 면 RAISE 'REREGISTER_COOLDOWN' (HINT 'cooldown', DETAIL = 해제 시각)
--      · 신청이 통과하면 cooldown_until = NULL
--   ⚠️ 행을 지웠다 새로 넣는 API 우회는 막지 않는다 — 앱엔 삭제 경로가 없고, 알림 폭탄은 291 이 막는다.
--
-- 영향: 컬럼 1 추가 + 함수 CREATE OR REPLACE. 트리거 정의 변경 없음.
-- 하위호환: 컬럼은 NULL 기본 → 기존 행·구버전 프론트 영향 없음(구버전은 예외를 「신청에 실패했어요」로 보여줌).
--   코드 푸시 «전에» 적용(프론트가 cooldown_until 을 읽음).
-- 복구: supabase/rollbacks/292_revert_cancel_cooldown.sql (170 본문 + 컬럼 DROP)
-- ============================================================

ALTER TABLE public.session_registrations
  ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.enforce_session_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_capacity    INT;
  v_signup_mode TEXT;
  v_count       INT;
BEGIN
  -- ① 취소 — 정원이 찬 상태에서의 취소면 3분 쿨다운 도장(알림 받은 사람이 먼저 잡을 틈)
  IF NEW.status = 'cancelled' THEN
    IF TG_OP = 'UPDATE' AND OLD.status = 'registered' THEN
      SELECT capacity, signup_mode INTO v_capacity, v_signup_mode
      FROM public.sessions WHERE id = NEW.session_id FOR UPDATE;
      IF v_signup_mode = 'rsvp' AND v_capacity IS NOT NULL THEN
        -- 본인 행 포함(아직 갱신 전) → «취소 직전에 꽉 차 있었나»
        SELECT count(*) INTO v_count
        FROM public.session_registrations
        WHERE session_id = NEW.session_id AND status = 'registered';
        IF v_count >= v_capacity THEN
          NEW.cooldown_until := now() + interval '3 minutes';
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status <> 'registered' THEN
    RETURN NEW;
  END IF;

  -- ② 정원 검사 (170 그대로) — 세션 행 잠금으로 동시 신청 직렬화
  SELECT capacity, signup_mode INTO v_capacity, v_signup_mode
  FROM public.sessions WHERE id = NEW.session_id FOR UPDATE;

  IF NOT (v_signup_mode = 'open' OR v_capacity IS NULL) THEN
    SELECT count(*) INTO v_count
    FROM public.session_registrations
    WHERE session_id = NEW.session_id AND status = 'registered' AND user_id <> NEW.user_id;
    IF v_count >= v_capacity THEN
      RAISE EXCEPTION 'SESSION_FULL' USING ERRCODE = 'P0001', HINT = 'capacity';
    END IF;
  END IF;

  -- ③ 재신청 쿨다운 — 자리가 있어도 3분 안이면 거부 (upsert 의 UPDATE 단계에서 OLD 가 취소 행)
  IF TG_OP = 'UPDATE' AND OLD.cooldown_until IS NOT NULL AND OLD.cooldown_until > now() THEN
    RAISE EXCEPTION 'REREGISTER_COOLDOWN'
      USING ERRCODE = 'P0001', HINT = 'cooldown', DETAIL = OLD.cooldown_until::text;
  END IF;

  NEW.cooldown_until := NULL;   -- 신청 통과 → 제한 해제
  RETURN NEW;
END;
$$;
