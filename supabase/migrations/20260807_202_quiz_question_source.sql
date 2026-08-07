-- ============================================================
-- Migration: 202 - quiz_questions 출처(source) 컬럼 + 조회 RPC 갱신
-- 작성일: 2026-08-07
-- 설명:
--   퀴즈 문항에 출처 URL을 저장한다. 정답 공개(reveal_answers) + 본인 제출 완료 시
--   참가자 결과 화면의 해설 옆에 「출처」 링크로 노출 → 건강 상식 신뢰도 제고.
--   라이브러리 템플릿으로 만든 문항은 발행 시 출처가 자동으로 채워진다.
--   nullable → 기존 문항·출처 없는 커스텀 문항은 그대로 동작(링크 미표시). 하위호환.
--
--   노출 조건은 explanation(083)과 동일하게 v_reveal 게이팅.
--   참가자는 quiz_questions 를 직접 SELECT 할 수 없고 이 RPC 로만 받으므로,
--   RPC 가 source 를 반환하지 않으면 화면에 뜨지 않는다 → RPC 도 함께 갱신.
--
-- 복구:
--   ALTER TABLE public.quiz_questions DROP COLUMN IF EXISTS source;
--   (RPC 는 083 정의로 CREATE OR REPLACE 하면 원복)
-- ============================================================

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS source TEXT;

-- 조회 RPC 갱신 — questions 에 source(노출조건부) 추가. 나머지는 083 과 동일.
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

  -- 정답·해설·출처 노출 조건: 정답 공개 ON + 본인 제출 완료
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
          'explanation', CASE WHEN v_reveal THEN qq.explanation ELSE NULL END,
          'source', CASE WHEN v_reveal THEN qq.source ELSE NULL END
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
