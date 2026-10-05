-- ============================================================
-- Rollback: 281 - 운영자 기록 RPC 제거
-- 주의: 화면 코드가 get_operator_record 를 쓰는 상태라면 코드부터 되돌린 뒤 실행한다.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_operator_record(UUID);
DROP INDEX IF EXISTS public.idx_programs_owner_end_date;
