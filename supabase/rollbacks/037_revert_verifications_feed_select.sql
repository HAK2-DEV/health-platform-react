-- ============================================================
-- ROLLBACK: 037 - verifications 피드 SELECT 정책 제거
-- 작성일: 2026-05-25
-- 짝: supabase/migrations/20260525_037_verifications_feed_select.sql
--
-- ⚠️ 수동 실행 전용. 정책만 제거 — 데이터 영향 없음.
-- ============================================================

DROP POLICY IF EXISTS "feed view approved verifications by program peers" ON public.verifications;
