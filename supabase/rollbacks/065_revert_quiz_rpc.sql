-- Rollback 065
DROP FUNCTION IF EXISTS public.submit_quiz(UUID, JSONB);
DROP FUNCTION IF EXISTS public.get_quiz_for_participant(UUID);
