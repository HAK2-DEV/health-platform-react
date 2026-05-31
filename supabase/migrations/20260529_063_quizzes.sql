-- ============================================================
-- Migration: 063 - quizzes + quiz_questions 테이블 + RLS
-- 작성일: 2026-05-29
-- 설명: 운영자가 만드는 퀴즈(게시물의 한 유형). SSRD 퀴즈 = MVP 2차 항목을 본인이 당김.
--   추후 공지사항 등 다른 게시물은 별도 테이블로 확장 (지금은 퀴즈 전용).
--
-- quizzes: 퀴즈 1개 = 여러 문제. due_at(풀이 기한), reveal_answers(정답 공개 여부).
-- quiz_questions: 문제. type(객관식/서술형/OX) + 문제별 점수/채점 정책.
--   award_mode: CORRECT_ONLY(맞춰야 점수) | ALWAYS(틀려도 점수, 참여형)
--   grading_mode: AUTO(자동) | MANUAL(운영자 수동 채점). 서술형에서만 의미, 객관식/OX 는 AUTO.
--   correct_answer 의미:
--     MULTIPLE → 정답 보기 인덱스 문자열 ('0','1'...)
--     OX       → 'O' | 'X'
--     SHORT    → 정답 텍스트 (grading_mode=AUTO 일 때). MANUAL 이면 NULL 허용.
--   options(JSONB): MULTIPLE 의 보기 배열 ["보기1","보기2",...]. OX/SHORT 는 NULL.
--
-- 정답 보안:
--   참가자는 quiz_questions 를 직접 SELECT 하지 못함 (correct_answer 노출 방지).
--   참가자용 문제 조회는 3단계에서 correct_answer 제외 RPC 로 제공.
--   본 마이그레이션의 SELECT 정책은 owner 전용.
--
-- 복구: supabase/rollbacks/063_revert_quizzes.sql
-- ============================================================

CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,                          -- 풀이 기한 (NULL = 무기한)
  reveal_answers BOOLEAN NOT NULL DEFAULT false, -- 참가자에게 정답 공개 여부
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quizzes_program ON public.quizzes(program_id);

CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('MULTIPLE', 'SHORT', 'OX')),
  question_text TEXT NOT NULL,
  options JSONB,                               -- MULTIPLE 의 보기 배열, 그 외 NULL
  correct_answer TEXT,                         -- MANUAL 서술형이면 NULL 허용
  point INT NOT NULL DEFAULT 0,
  award_mode TEXT NOT NULL DEFAULT 'CORRECT_ONLY' CHECK (award_mode IN ('CORRECT_ONLY', 'ALWAYS')),
  grading_mode TEXT NOT NULL DEFAULT 'AUTO' CHECK (grading_mode IN ('AUTO', 'MANUAL')),
  order_index INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_quiz_questions_quiz ON public.quiz_questions(quiz_id);


-- ─── RLS ─────────────────────────────────────────────────
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- quizzes SELECT: owner + ACTIVE 참여자 (참여자는 퀴즈 존재/메타는 볼 수 있어야 함)
CREATE POLICY "quiz: owner or participant can read"
ON public.quizzes FOR SELECT
TO authenticated
USING (
  program_id IN (SELECT id FROM public.programs WHERE owner_id = auth.uid())
  OR public._is_active_participant(program_id, auth.uid())
);

-- quizzes 쓰기: owner 만
CREATE POLICY "quiz: owner can insert"
ON public.quizzes FOR INSERT
TO authenticated
WITH CHECK (program_id IN (SELECT id FROM public.programs WHERE owner_id = auth.uid()));

CREATE POLICY "quiz: owner can update"
ON public.quizzes FOR UPDATE
TO authenticated
USING (program_id IN (SELECT id FROM public.programs WHERE owner_id = auth.uid()));

CREATE POLICY "quiz: owner can delete"
ON public.quizzes FOR DELETE
TO authenticated
USING (program_id IN (SELECT id FROM public.programs WHERE owner_id = auth.uid()));

-- quiz_questions SELECT: owner 전용 (정답 노출 방지 — 참가자는 RPC 로만)
CREATE POLICY "quiz_q: owner can read"
ON public.quiz_questions FOR SELECT
TO authenticated
USING (
  quiz_id IN (
    SELECT q.id FROM public.quizzes q
    JOIN public.programs p ON p.id = q.program_id
    WHERE p.owner_id = auth.uid()
  )
);

-- quiz_questions 쓰기: owner 만
CREATE POLICY "quiz_q: owner can write"
ON public.quiz_questions FOR ALL
TO authenticated
USING (
  quiz_id IN (
    SELECT q.id FROM public.quizzes q
    JOIN public.programs p ON p.id = q.program_id
    WHERE p.owner_id = auth.uid()
  )
)
WITH CHECK (
  quiz_id IN (
    SELECT q.id FROM public.quizzes q
    JOIN public.programs p ON p.id = q.program_id
    WHERE p.owner_id = auth.uid()
  )
);

-- ADMIN: 전체
CREATE POLICY "quiz: admins all" ON public.quizzes FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "quiz_q: admins all" ON public.quiz_questions FOR ALL TO authenticated USING (public.is_admin());
