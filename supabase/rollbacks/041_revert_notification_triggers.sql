-- ============================================================
-- ROLLBACK: 041 - 알림 트리거 3개 제거
-- 작성일: 2026-05-25
-- 짝: supabase/migrations/20260525_041_notification_triggers.sql
-- ============================================================

DROP TRIGGER IF EXISTS notify_review_on_verifications ON public.verifications;
DROP TRIGGER IF EXISTS notify_like_on_post_likes ON public.post_likes;
DROP TRIGGER IF EXISTS notify_comment_on_post_comments ON public.post_comments;

DROP FUNCTION IF EXISTS public.notify_on_verification_review();
DROP FUNCTION IF EXISTS public.notify_on_post_like();
DROP FUNCTION IF EXISTS public.notify_on_post_comment();
