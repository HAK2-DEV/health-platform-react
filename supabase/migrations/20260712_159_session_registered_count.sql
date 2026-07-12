-- ============================================================
-- Migration: 159 - 클래스 신청 인원 카운트(비정규화) + 트리거
-- 작성일: 2026-07-12
-- 설명:
--   session_registrations 는 RLS 로 "본인 행 + 운영자"만 조회 가능 →
--   참가자가 count 를 세면 본인 것만 나와 정원 표시가 틀어짐.
--   sessions.registered_count 를 두고 트리거로 유지 → 세션을 읽을 수 있는
--   모두(참가자 포함)가 정확한 신청 인원을 본다.
--
--   registered_count = status='registered' 인 session_registrations 수.
--   트리거는 SECURITY DEFINER — 참가자가 본인 신청을 넣을 때도 sessions 를
--   갱신해야 하므로(참가자는 sessions UPDATE 권한 없음).
--
-- 영향: sessions 1컬럼(기본 0) + 트리거 함수/트리거. 기존 동작 불변.
--   기존 신청분 백필 포함(현재는 없지만 재적용 안전).
--
-- 복구:
--   DROP TRIGGER IF EXISTS session_reg_count_trg ON public.session_registrations;
--   DROP FUNCTION IF EXISTS public._sync_session_registered_count();
--   ALTER TABLE public.sessions DROP COLUMN IF EXISTS registered_count;
-- ============================================================

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS registered_count INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public._sync_session_registered_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid UUID := COALESCE(NEW.session_id, OLD.session_id);
BEGIN
  UPDATE public.sessions s
    SET registered_count = (
      SELECT count(*) FROM public.session_registrations r
      WHERE r.session_id = sid AND r.status = 'registered'
    )
    WHERE s.id = sid;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS session_reg_count_trg ON public.session_registrations;
CREATE TRIGGER session_reg_count_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.session_registrations
  FOR EACH ROW EXECUTE FUNCTION public._sync_session_registered_count();

-- 기존 신청분 백필(재적용 안전)
UPDATE public.sessions s
  SET registered_count = (
    SELECT count(*) FROM public.session_registrations r
    WHERE r.session_id = s.id AND r.status = 'registered'
  );
