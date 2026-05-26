-- ============================================================
-- Rollback: 055 - 랭킹 / 입장 질문 컬럼 제거
-- ============================================================
ALTER TABLE public.programs
  DROP COLUMN IF EXISTS ranking_enabled,
  DROP COLUMN IF EXISTS entry_question;

ALTER TABLE public.program_participants
  DROP COLUMN IF EXISTS entry_answer;
