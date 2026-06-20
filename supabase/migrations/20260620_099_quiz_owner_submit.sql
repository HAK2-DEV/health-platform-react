-- ============================================================
-- Migration: 099 - 운영자도 퀴즈 참가(제출) 허용
-- 작성일: 2026-06-20
-- 설명:
--   submit_quiz 권한 검사를 get_quiz_for_participant 와 동일하게 —
--   "ACTIVE 참여자 OR 프로그램 owner" 로 확장. (기존엔 참여자만 → 운영자 제출 거부)
--   본문은 067(start_at 추가) 버전 그대로, 권한 한 줄만 변경.
--
-- 복구: 067 의 submit_quiz 로 되돌림(참여자만).
-- ============================================================

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

  -- 권한: ACTIVE 참여자 또는 owner (운영자도 참가 가능)
  IF NOT (
    public._is_active_participant(v_program_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.programs WHERE id = v_program_id AND owner_id = auth.uid())
  ) THEN
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
