-- ============================================================
-- ROLLBACK: 036 - post_likes + post_comments 테이블 제거
-- 작성일: 2026-05-25
-- 짝: supabase/migrations/20260525_036_post_likes_comments.sql
--
-- ⚠️ 수동 실행 전용. 모든 좋아요/댓글 데이터 손실.
-- ============================================================

DROP TABLE IF EXISTS public.post_comments;
DROP TABLE IF EXISTS public.post_likes;
