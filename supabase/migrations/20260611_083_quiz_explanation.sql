-- ============================================================
-- Migration: 083 - 퀴즈 문항 해설(explanation) 추가
-- 작성일: 2026-06-11
-- 설명: 운영자가 객관식/OX 문항에 해설을 작성하고, 「정답 공개」 ON 인 퀴즈에서
--   참가자가 제출 후 정답과 함께 해설을 볼 수 있게 함.
--   서술형(SHORT)은 해설 불필요(수동 채점) → 컬럼은 공용이나 UI/발행에서 미사용.
--
-- 노출 조건: get_quiz_for_participant 에서 correct_answer 와 동일하게
--   v_reveal(= reveal_answers AND 본인 제출 완료) 일 때만 explanation 반환.
-- ============================================================

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS explanation TEXT;

-- 조회 RPC 갱신 — questions 에 explanation(노출조건부) 추가
CREATE OR REPLACE FUNCTION public.get_quiz_for_participant(p_quiz_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz public.quizzes%ROWTYPE;
  v_program_id UUID;
  v_submission public.quiz_submissions%ROWTYPE;
  v_reveal BOOLEAN;
BEGIN
  SELECT * INTO v_quiz FROM public.quizzes WHERE id = p_quiz_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'quiz not found'; END IF;
  v_program_id := v_quiz.program_id;

  IF NOT (
    public._is_active_participant(v_program_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.programs WHERE id = v_program_id AND owner_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT * INTO v_submission
  FROM public.quiz_submissions
  WHERE quiz_id = p_quiz_id AND user_id = auth.uid();

  -- 정답·해설 노출 조건: 정답 공개 ON + 본인 제출 완료
  v_reveal := v_quiz.reveal_answers AND v_submission.id IS NOT NULL;

  RETURN jsonb_build_object(
    'quiz', jsonb_build_object(
      'id', v_quiz.id,
      'title', v_quiz.title,
      'description', v_quiz.description,
      'due_at', v_quiz.due_at,
      'start_at', v_quiz.start_at,
      'reveal_answers', v_quiz.reveal_answers
    ),
    'questions', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', qq.id,
          'type', qq.type,
          'question_text', qq.question_text,
          'options', qq.options,
          'point', qq.point,
          'award_mode', qq.award_mode,
          'grading_mode', qq.grading_mode,
          'order_index', qq.order_index,
          'correct_answer', CASE WHEN v_reveal THEN qq.correct_answer ELSE NULL END,
          'explanation', CASE WHEN v_reveal THEN qq.explanation ELSE NULL END
        ) ORDER BY qq.order_index
      ), '[]'::jsonb)
      FROM public.quiz_questions qq WHERE qq.quiz_id = p_quiz_id
    ),
    'my_submission', CASE WHEN v_submission.id IS NOT NULL THEN
      jsonb_build_object(
        'id', v_submission.id,
        'total_score', v_submission.total_score,
        'status', v_submission.status,
        'submitted_at', v_submission.submitted_at
      ) ELSE NULL END,
    'my_answers', CASE WHEN v_submission.id IS NOT NULL THEN (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'question_id', qa.question_id,
        'answer', qa.answer,
        'is_correct', qa.is_correct,
        'awarded_point', qa.awarded_point
      )), '[]'::jsonb)
      FROM public.quiz_answers qa WHERE qa.submission_id = v_submission.id
    ) ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_quiz_for_participant(UUID) TO authenticated;
