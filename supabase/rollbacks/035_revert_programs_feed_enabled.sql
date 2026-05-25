-- ============================================================
-- ROLLBACK: 035 - programs.feed_enabled 제거
-- 작성일: 2026-05-25
-- 짝: supabase/migrations/20260525_035_programs_feed_enabled.sql
--
-- ⚠️ 수동 실행 전용. 037 (verifications RLS 확장) 이 이 컬럼 참조하므로
--    037 rollback 먼저 실행 필요.
-- ============================================================

ALTER TABLE public.programs DROP COLUMN IF EXISTS feed_enabled;
