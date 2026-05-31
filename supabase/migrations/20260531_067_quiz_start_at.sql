-- ============================================================
-- Migration: 067 - quizzes.start_at 컬럼 + RPC 2개 갱신 (시작 기한)
-- 작성일: 2026-05-31
-- 설명: 풀이 기한에 "시작일" 추가. 운영자가 시작/끝을 모두 선택 가능.
--   start_at < now() 이전에는 참가자가 풀이 불가 (submit 거부, UI 안내).
--   NULL 이면 즉시 시작 (기존 동작 유지).
--
-- RPC 갱신:
--   - get_quiz_for_participant: 반환 JSON 에 start_at 포함
--   - submit_quiz: 시작 전 거부 ('quiz not started yet')
--
-- 복구: supabase/rollbacks/067_revert_quiz_start_at.sql
-- ============================================================

-- 컬럼 추가
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;

COMMENT ON COLUMN public.quizzes.start_at IS '풀이 시작일. NULL=즉시 시작.';


-- ─── 조회 RPC 갱신 ────────────────────────────────────────
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

  v_reveal := v_quiz.reveal_answers AND v_submission.id IS NOT NULL;

  RETURN jsonb_build_object(
    'quiz', jsonb_build_object(
      'id', v_quiz.id,
      'title', v_quiz.title,
      'description', v_quiz.description,
      'start_at', v_quiz.start_at,
      'due_at', v_quiz.due_at,
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
          'correct_answer', CASE WHEN v_reveal THEN qq.correct_answer ELSE NULL END
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


-- ─── 제출 RPC 갱신 (시작 전 거부) ─────────────────────────
CREATE OR REPLACE FUNCTION public.submit_quiz(p_quiz_id UUID, p_answers JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz public.quizzes%ROWTYPE;
  v_program_id UUID;
  v_submission_id UUID;
  v_total INT := 0;
  v_has_pending BOOLEAN := false;
  v_status TEXT;
  ans JSONB;
  v_q public.quiz_questions%ROWTYPE;
  v_user_answer TEXT;
  v_is_correct BOOLEAN;
  v_awarded INT;
BEGIN
  SELECT * INTO v_quiz FROM public.quizzes WHERE id = p_quiz_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'quiz not found'; END IF;
  v_program_id := v_quiz.program_id;

  IF NOT public._is_active_participant(v_program_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a participant';
  END IF;
  -- 시작 전 거부
  IF v_quiz.start_at IS NOT NULL AND v_quiz.start_at > now() THEN
    RAISE EXCEPTION 'quiz not started yet';
  END IF;
  -- 기한 종료
  IF v_quiz.due_at IS NOT NULL AND v_quiz.due_at < now() THEN
    RAISE EXCEPTION 'quiz closed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_submissions WHERE quiz_id = p_quiz_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'already submitted';
  END IF;

  INSERT INTO public.quiz_submissions (quiz_id, user_id, status, total_score)
  VALUES (p_quiz_id, auth.uid(), 'GRADED', 0)
  RETURNING id INTO v_submission_id;

  FOR ans IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    SELECT * INTO v_q
    FROM public.quiz_questions
    WHERE id = (ans->>'question_id')::uuid AND quiz_id = p_quiz_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    v_user_answer := ans->>'answer';

    IF v_q.type = 'SHORT' AND v_q.grading_mode = 'MANUAL' AND v_q.award_mode = 'CORRECT_ONLY' THEN
      v_is_correct := NULL;
      v_awarded := 0;
      v_has_pending := true;
    ELSE
      IF v_q.grading_mode = 'MANUAL' THEN
        v_is_correct := NULL;
      ELSE
        v_is_correct := (
          TRIM(LOWER(COALESCE(v_user_answer, ''))) = TRIM(LOWER(COALESCE(v_q.correct_answer, '')))
        );
      END IF;

      IF v_q.award_mode = 'ALWAYS' THEN
        v_awarded := v_q.point;
      ELSIF v_is_correct THEN
        v_awarded := v_q.point;
      ELSE
        v_awarded := 0;
      END IF;
      v_total := v_total + v_awarded;
    END IF;

    INSERT INTO public.quiz_answers (submission_id, question_id, answer, is_correct, awarded_point)
    VALUES (v_submission_id, v_q.id, v_user_answer, v_is_correct, v_awarded);
  END LOOP;

  v_status := CASE WHEN v_has_pending THEN 'PENDING' ELSE 'GRADED' END;

  UPDATE public.quiz_submissions
  SET total_score = v_total, status = v_status
  WHERE id = v_submission_id;

  IF v_status = 'GRADED' AND v_total > 0 THEN
    INSERT INTO public.score_ledgers (program_id, user_id, quiz_submission_id, point, reason)
    VALUES (v_program_id, auth.uid(), v_submission_id, v_total, '퀴즈: ' || v_quiz.title);
  END IF;

  RETURN jsonb_build_object(
    'submission_id', v_submission_id,
    'total_score', v_total,
    'status', v_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_quiz(UUID, JSONB) TO authenticated;
