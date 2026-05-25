-- ============================================================
-- ROLLBACK: 039 - verifications.feed_visible 제거
-- 작성일: 2026-05-25
-- 짝: supabase/migrations/20260525_039_verifications_feed_visible.sql
-- ============================================================

ALTER TABLE public.verifications DROP COLUMN IF EXISTS feed_visible;
