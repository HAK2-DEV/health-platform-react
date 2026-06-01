-- Rollback 068 — 053 시점 RPC 복원 필요
DROP FUNCTION IF EXISTS public.join_by_invite_code(TEXT);
DROP FUNCTION IF EXISTS public.lookup_invite_program(TEXT);
DROP INDEX IF EXISTS public.programs_invite_code_unique;
-- 053 join_with_invite_code(UUID, TEXT) 는 053 마이그레이션 재실행으로 복원.
