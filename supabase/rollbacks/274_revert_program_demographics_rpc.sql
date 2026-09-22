-- ============================================================
-- Rollback: 274 - 성별·연령대 열람 되돌리기
-- 작성일: 2026-09-22
-- ⚠️ 되돌리면 로그인 사용자가 다시 전 회원의 성별·연령대를 읽을 수 있다.
--    클라이언트가 RPC 를 쓰도록 바뀐 뒤라면, 되돌려도 화면은 그대로 동작한다.
-- ============================================================

GRANT SELECT (gender, age_range) ON public.users TO authenticated;
DROP FUNCTION IF EXISTS public.get_program_demographics(UUID);
