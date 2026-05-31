-- ============================================================
-- Migration: 064 - quiz_submissions + quiz_answers + score_ledgers 연동
-- 작성일: 2026-05-29
-- 설명: 참가자의 퀴즈 제출/답안 + 랭킹 점수 연동.
--
-- quiz_submissions: 1인 1회 제출 (UNIQUE quiz_id+user_id).
--   status: GRADED(자동채점 완료) | PENDING(수동 채점 대기 문제 존재).
--   total_score: 채점 완료 시 합계. 채점 완료 시점에 score_ledgers 로 반영.
-- quiz_answers: 문제별 답안 + 채점 결과.
--   is_correct: 자동채점 즉시 / 수동채점 대기는 NULL.
--   awarded_point: 실제 부여 점수 (award_mode/채점 결과 반영).
--
-- score_ledgers 연동:
--   quiz_submission_id 컬럼 추가 (UNIQUE, nullable) — 퀴즈 점수 출처 구분.
--   기존 verification_id 와 함께 "둘 중 하나"로 점수 1행의 출처를 나타냄.
--   채점 완료 시 점수 INSERT 는 3단계 RPC 가 담당 (미션 점수와 동일하게 랭킹 합산).
--
-- 복구: supabase/rollbacks/064_revert_quiz_submissions.sql
-- ============================================================

CREATE TABLE public.quiz_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_score INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'GRADED' CHECK (status IN ('GRADED', 'PENDING')),
  UNIQUE (quiz_id, user_id)
);

CREATE INDEX idx_quiz_submissions_quiz ON public.quiz_submissions(quiz_id);
CREATE INDEX idx_quiz_submissions_user ON public.quiz_submissions(user_id);

CREATE TABLE public.quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.quiz_submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  answer TEXT,
  is_correct BOOLEAN,          -- 수동 채점 대기면 NULL
  awarded_point INT NOT NULL DEFAULT 0,
  UNIQUE (submission_id, question_id)
);

CREATE INDEX idx_quiz_answers_submission ON public.quiz_answers(submission_id);

-- score_ledgers 퀴즈 연동 컬럼
ALTER TABLE public.score_ledgers
  ADD COLUMN IF NOT EXISTS quiz_submission_id UUID UNIQUE
    REFERENCES public.quiz_submissions(id) ON DELETE CASCADE;


-- ─── RLS ─────────────────────────────────────────────────
ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

-- submissions SELECT: 본인 OR program owner
CREATE POLICY "quiz_sub: own or owner read"
ON public.quiz_submissions FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR quiz_id IN (
    SELECT q.id FROM public.quizzes q
    JOIN public.programs p ON p.id = q.program_id
    WHERE p.owner_id = auth.uid()
  )
);

-- submissions INSERT: 본인 + ACTIVE 참여자
CREATE POLICY "quiz_sub: participant insert"
ON public.quiz_submissions FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public._is_active_participant(
    (SELECT program_id FROM public.quizzes WHERE id = quiz_id),
    auth.uid()
  )
);

-- submissions UPDATE: owner (수동 채점으로 total_score/status 갱신)
CREATE POLICY "quiz_sub: owner update"
ON public.quiz_submissions FOR UPDATE
TO authenticated
USING (
  quiz_id IN (
    SELECT q.id FROM public.quizzes q
    JOIN public.programs p ON p.id = q.program_id
    WHERE p.owner_id = auth.uid()
  )
);

-- answers SELECT: 본인 submission OR owner
CREATE POLICY "quiz_ans: own or owner read"
ON public.quiz_answers FOR SELECT
TO authenticated
USING (
  submission_id IN (SELECT id FROM public.quiz_submissions WHERE user_id = auth.uid())
  OR submission_id IN (
    SELECT s.id FROM public.quiz_submissions s
    JOIN public.quizzes q ON q.id = s.quiz_id
    JOIN public.programs p ON p.id = q.program_id
    WHERE p.owner_id = auth.uid()
  )
);

-- answers INSERT: 본인 submission
CREATE POLICY "quiz_ans: own insert"
ON public.quiz_answers FOR INSERT
TO authenticated
WITH CHECK (
  submission_id IN (SELECT id FROM public.quiz_submissions WHERE user_id = auth.uid())
);

-- answers UPDATE: owner (수동 채점 is_correct/awarded_point)
CREATE POLICY "quiz_ans: owner update"
ON public.quiz_answers FOR UPDATE
TO authenticated
USING (
  submission_id IN (
    SELECT s.id FROM public.quiz_submissions s
    JOIN public.quizzes q ON q.id = s.quiz_id
    JOIN public.programs p ON p.id = q.program_id
    WHERE p.owner_id = auth.uid()
  )
);

-- ADMIN
CREATE POLICY "quiz_sub: admins all" ON public.quiz_submissions FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "quiz_ans: admins all" ON public.quiz_answers FOR ALL TO authenticated USING (public.is_admin());
