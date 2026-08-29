-- 249 되돌리기 — 성장 탭 실데이터 RPC 제거
-- 읽기 전용 함수라 지워도 기존 동작에 영향 없음.
DROP FUNCTION IF EXISTS public.get_program_garden(UUID);
DROP INDEX IF EXISTS public.idx_verifications_user_submitted;
