-- ============================================================
-- ROLLBACK: 038 - storage 피드 참여자 SELECT 정책 제거
-- 작성일: 2026-05-25
-- 짝: supabase/migrations/20260525_038_storage_feed_peer_read.sql
-- ============================================================

DROP POLICY IF EXISTS "verification images: feed peers can read" ON storage.objects;
