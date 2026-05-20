-- ============================================================
-- Migration: 027 - programs 기간 변경 시 missions 활성 기간 자동 동기화
-- 작성일: 2026-05-20
-- 설명: 운영자가 프로그램 수정으로 start_date / end_date 를 변경하면
--       해당 프로그램의 모든 missions.active_from / active_until 을 자동 동기화.
--
-- 발화 시점:
--   AFTER UPDATE OF start_date, end_date ON programs
--   → start_date 또는 end_date 가 실제로 바뀐 행만 처리 (DISTINCT FROM 검사)
--
-- 변환 방식 (023 패턴 일치):
--   active_from  = '{start_date} 00:00:00+09:00' (KST 자정)
--   active_until = '{end_date}   23:59:59+09:00' (KST 그날 끝)
--
-- 적용 범위:
--   현재 MVP 정책상 start_date 는 운영자 수정 불가지만, 일반화 트리거로 둘 다 처리.
--   미래에 마법사 재진입(나) 도입 시에도 자동 동기화 보장.
--
-- 안전성:
--   SECURITY DEFINER 로 RLS 우회 (트리거 안에서 missions UPDATE).
--   missions UPDATE 정책은 owner 만 허용인데, 본 트리거가 owner 행위의 후속 처리라
--   안전.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_missions_active_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- start_date 또는 end_date 가 실제로 바뀌었을 때만 처리
  IF NEW.start_date IS DISTINCT FROM OLD.start_date
     OR NEW.end_date IS DISTINCT FROM OLD.end_date THEN
    UPDATE public.missions
    SET active_from  = (NEW.start_date::text || ' 00:00:00+09:00')::timestamptz,
        active_until = (NEW.end_date::text   || ' 23:59:59+09:00')::timestamptz,
        updated_at   = NOW()
    WHERE program_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS sync_missions_on_program_dates ON public.programs;
CREATE TRIGGER sync_missions_on_program_dates
AFTER UPDATE OF start_date, end_date ON public.programs
FOR EACH ROW
EXECUTE FUNCTION public.sync_missions_active_period();
