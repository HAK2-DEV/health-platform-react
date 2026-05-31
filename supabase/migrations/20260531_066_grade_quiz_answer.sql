-- ============================================================
-- Migration: 066 - grade_quiz_answer RPC (운영자 수동 채점)
-- 작성일: 2026-05-31
-- 설명: 서술형 MANUAL+CORRECT_ONLY 답안을 운영자가 정답/오답 채점.
--   채점된 답의 awarded_point 갱신 → 해당 submission 의 모든 답이 채점되면
--   status=GRADED 로 확정 + total_score 재계산 + score_ledgers 반영.
--
-- award_mode=ALWAYS 라면 자동으로 point 지급(어차피 submit_quiz 단계에서 처리됨).
-- 이 RPC 가 실제 호출되는 케이스는 SHORT + MANUAL + CORRECT_ONLY 답안뿐.
--
-- score_ledgers 갱신 패턴: DELETE + INSERT (혹시 부분 채점 후 재채점 시 안전).
-- UNIQUE(quiz_submission_id) 제약을 활용.
--
-- 복구: supabase/rollbacks/066_revert_grade_quiz_answer.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.grade_quiz_answer(p_answer_id UUID, p_is_correct BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_answer public.quiz_answers%ROWTYPE;
  v_question public.quiz_questions%ROWTYPE;
  v_submission public.quiz_submissions%ROWTYPE;
  v_quiz public.quizzes%ROWTYPE;
  v_program_id UUID;
  v_owner_id UUID;
  v_awarded INT;
  v_all_graded BOOLEAN;
  v_total INT;
  v_new_status TEXT;
BEGIN
  SELECT * INTO v_answer FROM public.quiz_answers WHERE id = p_answer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'answer not found'; END IF;

  SELECT * INTO v_question FROM public.quiz_questions WHERE id = v_answer.question_id;
  SELECT * INTO v_submission FROM public.quiz_submissions WHERE id = v_answer.submission_id;
  SELECT * INTO v_quiz FROM public.quizzes WHERE id = v_submission.quiz_id;
  v_program_id := v_quiz.program_id;

  -- 권한: program owner 만
  SELECT owner_id INTO v_owner_id FROM public.programs WHERE id = v_program_id;
  IF v_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  -- awarded_point 계산
  IF v_question.award_mode = 'ALWAYS' THEN
    v_awarded := v_question.point;
  ELSIF p_is_correct THEN
    v_awarded := v_question.point;
  ELSE
    v_awarded := 0;
  END IF;

  UPDATE public.quiz_answers
  SET is_correct = p_is_correct, awarded_point = v_awarded
  WHERE id = p_answer_id;

  -- 해당 submission 의 모든 답이 채점됐는지
  SELECT NOT EXISTS(
    SELECT 1 FROM public.quiz_answers
    WHERE submission_id = v_answer.submission_id AND is_correct IS NULL
  ) INTO v_all_graded;

  IF v_all_graded THEN
    SELECT COALESCE(SUM(awarded_point), 0) INTO v_total
    FROM public.quiz_answers WHERE submission_id = v_answer.submission_id;

    UPDATE public.quiz_submissions
    SET total_score = v_total, status = 'GRADED'
    WHERE id = v_answer.submission_id;

    -- score_ledgers 재반영 (재채점 안전)
    DELETE FROM public.score_ledgers WHERE quiz_submission_id = v_answer.submission_id;
    IF v_total > 0 THEN
      INSERT INTO public.score_ledgers (program_id, user_id, quiz_submission_id, point, reason)
      VALUES (v_program_id, v_submission.user_id, v_answer.submission_id, v_total, '퀴즈: ' || v_quiz.title);
    END IF;

    v_new_status := 'GRADED';
  ELSE
    v_new_status := 'PENDING';
  END IF;

  RETURN jsonb_build_object(
    'awarded_point', v_awarded,
    'all_graded', v_all_graded,
    'status', v_new_status,
    'total_score', COALESCE(v_total, v_submission.total_score)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.grade_quiz_answer(UUID, BOOLEAN) TO authenticated;
