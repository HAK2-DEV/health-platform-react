-- ============================================================
-- ROLLBACK: 032 - missions 일정 컬럼 제거
-- 작성일: 2026-05-22
-- 짝: supabase/migrations/20260522_032_missions_schedule.sql
--
-- ⚠️ 수동 실행 전용. 033 (점수 트리거 업데이트) 이 이 컬럼들을 참조하므로
--    이 rollback 실행 전 033 rollback 을 먼저 실행해야 함.
-- ============================================================

ALTER TABLE public.missions DROP COLUMN IF EXISTS excluded_periods;
ALTER TABLE public.missions DROP COLUMN IF EXISTS active_days;
ALTER TABLE public.missions DROP COLUMN IF EXISTS schedule_mode;
