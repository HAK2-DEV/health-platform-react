-- ============================================================
-- Migration: 081 - 프로그램 생성 한도에서 어드민 제외
-- 작성일: 2026-06-11
-- 설명: 079 의 enforce_program_limit 트리거를 갱신 — ADMIN(users.role='ADMIN')은
--   베타 프로그램 개수 제한(PUBLISHED 2개)을 받지 않도록 면제.
--
-- 나머지 동작은 079 와 동일 (게시 전환 시점에 PUBLISHED 개수 검사).
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_program_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max INT := 2;          -- 베타 한도 (constants.js MAX_PROGRAMS_BETA 와 동일하게 유지)
  v_count INT;
BEGIN
  -- 어드민은 한도 면제
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- PUBLISHED 로 "새로 전환"되는 경우에만 검사
  --   INSERT: 곧장 PUBLISHED 로 들어오는 경우
  --   UPDATE: DRAFT(또는 그 외)에서 PUBLISHED 로 바뀌는 경우
  IF NEW.status = 'PUBLISHED'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'PUBLISHED') THEN

    SELECT COUNT(*)
    INTO v_count
    FROM public.programs
    WHERE owner_id = NEW.owner_id
      AND status = 'PUBLISHED'    -- 종료(ENDED)·보관(ARCHIVED)은 슬롯 미점유
      AND id <> NEW.id;          -- 자기 자신 제외

    IF v_count >= v_max THEN
      RAISE EXCEPTION '베타 기간에는 프로그램을 최대 %개까지만 운영할 수 있어요. 기존 프로그램을 삭제한 뒤 다시 시도해주세요.', v_max
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 트리거 자체는 079 에서 이미 생성됨 (함수만 갱신하면 됨).
