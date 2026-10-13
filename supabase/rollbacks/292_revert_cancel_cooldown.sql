-- ============================================================
-- Rollback: 292 - 취소 3분 쿨다운 되돌리기 (170 함수 본문 + 컬럼 DROP)
-- 작성일: 2026-10-13
--   함수를 170 원문으로 되돌린 «뒤에» 컬럼을 지운다(함수가 컬럼을 참조하는 동안 지우면 실행 시 오류).
-- ============================================================

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
  IF NEW.status <> 'registered' THEN
    RETURN NEW;
  END IF;

  SELECT capacity, signup_mode INTO v_capacity, v_signup_mode
  FROM public.sessions
  WHERE id = NEW.session_id
  FOR UPDATE;

  IF v_signup_mode = 'open' OR v_capacity IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.session_registrations
  WHERE session_id = NEW.session_id
    AND status = 'registered'
    AND user_id <> NEW.user_id;

  IF v_count >= v_capacity THEN
    RAISE EXCEPTION 'SESSION_FULL'
      USING ERRCODE = 'P0001', HINT = 'capacity';
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.session_registrations DROP COLUMN IF EXISTS cooldown_until;
