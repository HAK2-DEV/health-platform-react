-- ============================================================
-- Migration: 161 - 현장 출석 코드(venue_code) 저장 + 자가체크 RPC
-- 작성일: 2026-07-12
-- 설명:
--   venue_code 방식: 강사가 현장에서 6자리 코드 공지 → 참가자가 입력해 자가 출석.
--   ⚠️ 코드는 참가자에게 노출되면 안 됨(현장 없이 출석 가능해짐) → sessions 컬럼(참가자
--   SELECT 가능) 대신 운영자 전용 테이블 session_codes 에 저장. 참가자는 RPC 로 "검증만".
--
--   check_in_with_code(session, code): SECURITY DEFINER
--     - 프로그램 모드 venue_code · 활성 참가자 · 코드 일치 확인 → session_attendance confirmed
--     - 결과 문자열 반환(ok / wrong_code / no_code / not_participant / mode / not_found)
--     - confirmed 되면 160 트리거가 포인트 부여.
--
-- 영향: 신규 테이블 1개(운영자 전용) + RPC 1개. 기존 동작 불변.
--   (sessions.attend_code 는 미사용 — 노출 방지 위해 사용 안 함. 컬럼은 잔존, 무해)
--
-- 복구:
--   DROP FUNCTION IF EXISTS public.check_in_with_code(uuid, text);
--   DROP TABLE IF EXISTS public.session_codes;
-- ============================================================

CREATE TABLE IF NOT EXISTS public.session_codes (
  session_id UUID PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.session_codes ENABLE ROW LEVEL SECURITY;

-- 운영자만 조회·설정 (참가자 정책 없음 = 거부). RPC 는 DEFINER 라 이 정책과 무관.
DROP POLICY IF EXISTS session_codes_owner_all ON public.session_codes;
CREATE POLICY session_codes_owner_all ON public.session_codes
  FOR ALL TO authenticated
  USING     (EXISTS (SELECT 1 FROM public.sessions s JOIN public.programs p ON p.id = s.program_id
                     WHERE s.id = session_codes.session_id AND p.owner_id = auth.uid()))
  WITH CHECK(EXISTS (SELECT 1 FROM public.sessions s JOIN public.programs p ON p.id = s.program_id
                     WHERE s.id = session_codes.session_id AND p.owner_id = auth.uid()));

-- 참가자 자가 체크인 — 코드 검증 후 confirmed(코드 자체는 반환/노출 안 함)
CREATE OR REPLACE FUNCTION public.check_in_with_code(p_session_id UUID, p_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prog UUID;
  v_mode TEXT;
  v_code TEXT;
BEGIN
  SELECT s.program_id, p.class_attendance_mode
    INTO v_prog, v_mode
  FROM public.sessions s JOIN public.programs p ON p.id = s.program_id
  WHERE s.id = p_session_id;

  IF v_prog IS NULL THEN RETURN 'not_found'; END IF;
  IF v_mode <> 'venue_code' THEN RETURN 'mode'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.program_participants pp
    WHERE pp.program_id = v_prog AND pp.user_id = auth.uid() AND pp.status = 'ACTIVE'
  ) THEN
    RETURN 'not_participant';
  END IF;

  SELECT code INTO v_code FROM public.session_codes WHERE session_id = p_session_id;
  IF v_code IS NULL THEN RETURN 'no_code'; END IF;
  IF lower(btrim(v_code)) <> lower(btrim(COALESCE(p_code, ''))) THEN RETURN 'wrong_code'; END IF;

  INSERT INTO public.session_attendance (session_id, user_id, status, method)
  VALUES (p_session_id, auth.uid(), 'confirmed', 'venue_code')
  ON CONFLICT (session_id, user_id) DO UPDATE SET status = 'confirmed', method = 'venue_code';

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_with_code(UUID, TEXT) TO authenticated;
