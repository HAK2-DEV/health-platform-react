-- ============================================================
-- Migration: 098 - programs.updated_at 자동 갱신 트리거
-- 작성일: 2026-06-20
-- 설명:
--   programs 행이 UPDATE 될 때마다 updated_at = now() 로 자동 갱신.
--   (기존엔 트리거가 없어 생성 시각에 머물러 있었음)
--   운영중 목록을 "최근 수정순"으로 정렬하기 위함.
--
-- 복구: DROP TRIGGER + FUNCTION.
-- ============================================================

CREATE OR REPLACE FUNCTION public.tg_programs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS programs_set_updated_at ON public.programs;
CREATE TRIGGER programs_set_updated_at
  BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.tg_programs_updated_at();
