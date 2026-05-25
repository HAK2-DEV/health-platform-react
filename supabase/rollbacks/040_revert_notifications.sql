-- ============================================================
-- ROLLBACK: 040 - notifications 테이블 제거
-- 작성일: 2026-05-25
-- 짝: supabase/migrations/20260525_040_notifications.sql
--
-- ⚠️ 수동 실행 전용. 모든 알림 데이터 손실.
--    041 (트리거) 가 이 테이블 참조하므로 041 rollback 먼저 실행 필요.
-- ============================================================

DROP TABLE IF EXISTS public.notifications;
