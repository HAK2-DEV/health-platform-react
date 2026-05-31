-- ============================================================
-- Migration: 065 - 퀴즈 참가자 RPC (조회 + 제출/자동채점)
-- 작성일: 2026-05-29
-- 설명: 참가자가 정답을 못 보게 하면서 퀴즈를 풀고 제출하는 보안 경로.
--   quiz_questions 는 owner 만 직접 SELECT 가능(063 RLS) → 참가자는 이 RPC 로만.
--
-- get_quiz_for_participant(p_quiz_id):
--   - 권한: ACTIVE 참여자 또는 owner
--   - 정답(correct_answer)은 reveal_answers=true 이고 본인이 이미 제출했을 때만 포함
--   - 본인 제출/답안도 함께 반환 (이미 푼 경우 결과 표시용)
--
-- submit_quiz(p_quiz_id, p_answers):
--   - p_answers: [{ "question_id": uuid, "answer": text }, ...]
--   - 권한/기한/중복제출 검증 후 채점
--   - 자동 채점(객관식/OX/서술형 AUTO): correct_answer 비교 (서술형은 trim+소문자)
--   - award_mode=ALWAYS → 틀려도 point 지급 / CORRECT_ONLY → 맞을 때만
--   - 서술형 MANUAL + CORRECT_ONLY → 채점 보류(is_correct NULL, awarded 0) → status=PENDING
--   - status=GRADED 이고 점수>0 이면 score_ledgers 에 INSERT (미션 점수와 합산되어 랭킹 반영)
--
-- 복구: supabase/rollbacks/065_revert_quiz_rpc.sql
-- ============================================================

-- ─── 조회 RPC ─────────────────────────────────────────────
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

  -- 권한: ACTIVE 참여자 또는 owner
  IF NOT (
    public._is_active_participant(v_program_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.programs WHERE id = v_program_id AND owner_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT * INTO v_submission
  FROM public.quiz_submissions
  WHERE quiz_id = p_quiz_id AND user_id = auth.uid();

  -- 정답 노출 조건: 정답 공개 ON + 본인 제출 완료
  v_reveal := v_quiz.reveal_answers AND v_submission.id IS NOT NULL;

  RETURN jsonb_build_object(
    'quiz', jsonb_build_object(
      'id', v_quiz.id,
      'title', v_quiz.title,
      'description', v_quiz.description,
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


-- ─── 제출 + 자동채점 RPC ──────────────────────────────────
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

  -- 권한
  IF NOT public._is_active_participant(v_program_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a participant';
  END IF;
  -- 기한
  IF v_quiz.due_at IS NOT NULL AND v_quiz.due_at < now() THEN
    RAISE EXCEPTION 'quiz closed';
  END IF;
  -- 중복 제출 방지
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
      -- 수동 채점 보류
      v_is_correct := NULL;
      v_awarded := 0;
      v_has_pending := true;
    ELSE
      -- 자동 채점 (MANUAL 이어도 ALWAYS 면 무조건 지급)
      IF v_q.grading_mode = 'MANUAL' THEN
        v_is_correct := NULL;  -- 정답 판정 생략
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

  -- 자동 채점 완료 + 점수>0 → 랭킹 반영
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
