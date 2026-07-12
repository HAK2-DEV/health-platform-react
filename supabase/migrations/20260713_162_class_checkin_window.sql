-- ============================================================
-- Migration: 162 - 클래스 출석 제한(신청자 + 시작 N분 전부터)
-- 작성일: 2026-07-13
-- 설명:
--   참가자 자가출석(venue_code·self_approve)을 두 조건으로 제한:
--     1) 사전 신청(rsvp) 클래스는 「신청한 사람」만 (open 클래스는 제한 없음)
--     2) 클래스 시작 N분 전 ~ 종료 후 3시간 사이에만 (N = programs.class_checkin_before_min)
--   운영자가 마법사에서 N(분)을 설정. 기본 30분.
--
--   - programs.class_checkin_before_min INT DEFAULT 30
--   - check_in_with_code RPC: 신청·시간창 검증 추가(반환코드 not_registered/too_early/too_late)
--   - self_approve 자가출석 INSERT RLS: 신청·시간창 조건 추가
--
-- 영향: programs 1컬럼(기본값) + RPC/RLS 갱신. 기존 동작 강화(더 엄격). operator_roll 무관.
--
-- 복구:
--   ALTER TABLE public.programs DROP COLUMN IF EXISTS class_checkin_before_min;
--   (RPC/RLS 는 161·158 버전으로 되돌리려면 해당 마이그레이션 재적용)
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS class_checkin_before_min INT NOT NULL DEFAULT 30;

-- ── check_in_with_code — 신청·시간창 검증 추가 ──
CREATE OR REPLACE FUNCTION public.check_in_with_code(p_session_id UUID, p_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prog   UUID;
  v_mode   TEXT;
  v_signup TEXT;
  v_start  TIMESTAMPTZ;
  v_end    TIMESTAMPTZ;
  v_before INT;
  v_code   TEXT;
BEGIN
  SELECT s.program_id, p.class_attendance_mode, s.signup_mode, s.starts_at, s.ends_at, p.class_checkin_before_min
    INTO v_prog, v_mode, v_signup, v_start, v_end, v_before
  FROM public.sessions s JOIN public.programs p ON p.id = s.program_id
  WHERE s.id = p_session_id;

  IF v_prog IS NULL THEN RETURN 'not_found'; END IF;
  IF v_mode <> 'venue_code' THEN RETURN 'mode'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.program_participants pp
    WHERE pp.program_id = v_prog AND pp.user_id = auth.uid() AND pp.status = 'ACTIVE'
  ) THEN RETURN 'not_participant'; END IF;

  -- 사전 신청 클래스는 신청자만
  IF v_signup = 'rsvp' AND NOT EXISTS (
    SELECT 1 FROM public.session_registrations r
    WHERE r.session_id = p_session_id AND r.user_id = auth.uid() AND r.status = 'registered'
  ) THEN RETURN 'not_registered'; END IF;

  -- 시간 창: 시작 N분 전 ~ 종료 후 3시간
  IF now() < v_start - make_interval(mins => COALESCE(v_before, 30)) THEN RETURN 'too_early'; END IF;
  IF now() > COALESCE(v_end, v_start) + interval '3 hours' THEN RETURN 'too_late'; END IF;

  SELECT code INTO v_code FROM public.session_codes WHERE session_id = p_session_id;
  IF v_code IS NULL THEN RETURN 'no_code'; END IF;
  IF lower(btrim(v_code)) <> lower(btrim(COALESCE(p_code, ''))) THEN RETURN 'wrong_code'; END IF;

  INSERT INTO public.session_attendance (session_id, user_id, status, method)
  VALUES (p_session_id, auth.uid(), 'confirmed', 'venue_code')
  ON CONFLICT (session_id, user_id) DO UPDATE SET status = 'confirmed', method = 'venue_code';

  RETURN 'ok';
END;
$$;

-- ── self_approve 자가출석 INSERT RLS — 신청·시간창 조건 추가 ──
DROP POLICY IF EXISTS session_att_own_insert ON public.session_attendance;
CREATE POLICY session_att_own_insert ON public.session_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.programs p ON p.id = s.program_id
      JOIN public.program_participants pp ON pp.program_id = s.program_id
      WHERE s.id = session_attendance.session_id
        AND pp.user_id = auth.uid() AND pp.status = 'ACTIVE'
        AND (s.signup_mode = 'open' OR EXISTS (
          SELECT 1 FROM public.session_registrations r
          WHERE r.session_id = s.id AND r.user_id = auth.uid() AND r.status = 'registered'))
        AND now() >= s.starts_at - make_interval(mins => COALESCE(p.class_checkin_before_min, 30))
        AND now() <= COALESCE(s.ends_at, s.starts_at) + interval '3 hours'
    )
  );
