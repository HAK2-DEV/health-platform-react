-- ============================================================
-- Rollback: 072 - notification_preferences 및 트리거 변경 되돌림
-- 작성일: 2026-06-03
--
-- 주의:
--   - 트리거 함수는 본인이 041/042 의 원본으로 다시 적용해야 함 (CREATE OR REPLACE 만 되돌리고 끝)
--     → 본 rollback 은 함수 재정의 안 함 — 본인이 041 또는 042 migration 을 재실행해 복원 가능.
--   - notification_preferences 테이블/함수만 제거.
-- ============================================================

DROP FUNCTION IF EXISTS public.is_notification_enabled(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_or_create_my_notification_preferences();
DROP TABLE IF EXISTS public.notification_preferences CASCADE;

-- 트리거 함수 복원 안내:
--   supabase migration 041 (notification_triggers) 와 042 (operator_notifications) 를
--   다시 실행하면 preference 체크 없는 원본 함수로 되돌아감.
