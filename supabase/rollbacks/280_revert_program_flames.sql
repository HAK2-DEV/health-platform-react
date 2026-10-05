-- ============================================================
-- Rollback: 280 - 닉네임 옆 불꽃 설정 컬럼 + 계산 RPC 제거
-- 주의: 화면 코드가 flame_enabled / get_program_flames 를 쓰는 상태라면
--       코드부터 되돌린 뒤 실행한다(컬럼을 고르는 쿼리가 통째로 실패한다).
-- ============================================================

DROP FUNCTION IF EXISTS public.get_program_flames(UUID);

ALTER TABLE public.programs DROP CONSTRAINT IF EXISTS programs_flame_week_days_check;
ALTER TABLE public.programs DROP COLUMN IF EXISTS flame_week_days;
ALTER TABLE public.programs DROP COLUMN IF EXISTS flame_enabled;
