-- Rollback 064
ALTER TABLE public.score_ledgers DROP COLUMN IF EXISTS quiz_submission_id;
DROP TABLE IF EXISTS public.quiz_answers CASCADE;
DROP TABLE IF EXISTS public.quiz_submissions CASCADE;
