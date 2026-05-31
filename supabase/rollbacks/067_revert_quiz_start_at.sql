-- Rollback 067 — start_at 컬럼 제거. RPC 들은 065 로 복원.
ALTER TABLE public.quizzes DROP COLUMN IF EXISTS start_at;
-- 주의: RPC 는 065 마이그레이션을 다시 실행해 옛 시그니처로 복원.
