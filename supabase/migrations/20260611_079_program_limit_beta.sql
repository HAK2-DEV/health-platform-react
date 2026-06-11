-- ============================================================
-- Migration: 079 - 베타 프로그램 생성 한도 (운영자 1인당 2개)
-- 작성일: 2026-06-11
-- 설명: 운영자가 동시에 운영하는 PUBLISHED 프로그램을 2개로 제한.
--
-- 카운트 대상: 본인 소유의 PUBLISHED 프로그램만
--   - DRAFT   : 작성 중(마법사) — 한도 미포함 (게시 전엔 실 프로그램 아님)
--   - ENDED   : 종료됨 — 한도 미포함 (슬롯 회수 → 새 프로그램 생성 가능)
--   - ARCHIVED: 숨김 — 한도 미포함
--   - 하드 삭제: 행이 사라지므로 자동으로 슬롯 회수
--
-- 강제 시점: 게시(DRAFT→PUBLISHED) 또는 PUBLISHED 로의 직접 INSERT.
--   마법사는 1단계에서 DRAFT 로 미리 INSERT 하므로 INSERT 차단은 부적절
--   (버려진 draft 가 슬롯을 먹는 문제) → 게시 전환 시점에 검사.
--
-- 한도 변경(정식 출시): 아래 v_max 값 + 클라이언트 constants.js 의
--   MAX_PROGRAMS_BETA 를 함께 수정.
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

DROP TRIGGER IF EXISTS enforce_program_limit_trigger ON public.programs;
CREATE TRIGGER enforce_program_limit_trigger
BEFORE INSERT OR UPDATE ON public.programs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_program_limit();
