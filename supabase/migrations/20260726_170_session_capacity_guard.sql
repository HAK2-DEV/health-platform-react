-- ============================================================
-- Migration: 170 - 클래스 세션 정원(선착순) 서버측 강제
-- 작성일: 2026-07-26
-- 설명:
--   session_registrations 신청에 정원 강제가 DB에 없었다. 클라이언트는 정원이
--   차면 신청 버튼을 숨겼지만(ClassDetail 'full'), 서버 registerSession 은 정원
--   체크 없는 단순 upsert → 동시 신청(레이스)이나 API 직접 호출 시 정원 초과가
--   그대로 저장됐다. (팀은 team_member_capacity 트리거로 막는데 세션만 누락.)
--
--   해결: BEFORE INSERT OR UPDATE 트리거로, status='registered' 로 들어올 때
--     · signup_mode='open' 또는 capacity IS NULL → 무제한(통과)
--     · 그 외엔 세션 행을 FOR UPDATE 로 잠가 동시성 직렬화 후,
--       현재 'registered' 수(본인 행 제외) >= capacity 면 SESSION_FULL 예외.
--   FOR UPDATE 로 잠그므로 count-then-insert 레이스도 방지된다.
--
-- 하위호환: 신규 신청에만 적용. 기존 데이터 변경 없음(이미 초과 저장된 게 있어도
--   그대로 두되, 새 신청은 정원까지만). CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
--   재신청(cancelled→registered upsert)은 본인 행 제외 카운트라 정상 처리.
--
-- 복구:
--   DROP TRIGGER IF EXISTS session_reg_capacity_trg ON public.session_registrations;
--   DROP FUNCTION IF EXISTS public.enforce_session_capacity();
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
  -- 'registered' 로 들어오는 경우만 검사 (취소/기타는 통과)
  IF NEW.status <> 'registered' THEN
    RETURN NEW;
  END IF;

  -- 세션 행 잠금 → 같은 세션 동시 신청 직렬화 (레이스 방지)
  SELECT capacity, signup_mode INTO v_capacity, v_signup_mode
  FROM public.sessions
  WHERE id = NEW.session_id
  FOR UPDATE;

  -- 자유 참여(open) 또는 정원 무제한(NULL) → 통과
  IF v_signup_mode = 'open' OR v_capacity IS NULL THEN
    RETURN NEW;
  END IF;

  -- 현재 신청 인원(본인 행 제외)
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

DROP TRIGGER IF EXISTS session_reg_capacity_trg ON public.session_registrations;
CREATE TRIGGER session_reg_capacity_trg
  BEFORE INSERT OR UPDATE OF status ON public.session_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_session_capacity();
