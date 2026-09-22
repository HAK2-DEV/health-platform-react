-- ============================================================
-- Rollback: 273 - users UPDATE 권한 되돌리기
-- 작성일: 2026-09-22
-- ⚠️ 되돌리면 로그인 사용자가 다시 전 컬럼(role·email·created_at 포함) UPDATE 권한을 갖는다.
--    role 승격은 RLS 정책의 WITH CHECK 하나만 남는다.
-- ============================================================

GRANT UPDATE ON public.users TO authenticated;
