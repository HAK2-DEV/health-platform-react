-- ============================================================
-- Rollback: 049 - users.avatar_path 제거
-- ============================================================
ALTER TABLE public.users DROP COLUMN IF EXISTS avatar_path;
