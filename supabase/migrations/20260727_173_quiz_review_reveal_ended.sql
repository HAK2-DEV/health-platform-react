-- ============================================================
-- Migration: 173 - 종료된 퀴즈는 참가자에게도 정답·해설 공개
-- 작성일: 2026-07-27
-- 설명:
--   172 의 get_user_quiz_review 는 정답·해설을 owner 이거나 reveal_answers=true 일 때만
--   노출했다. 여기에 「퀴즈 마감(due_at)이 지난 종료 퀴즈」 조건을 추가한다.
--     노출 조건: owner  OR  reveal_answers  OR  (due_at IS NOT NULL AND due_at < now())
--   → 마감 지난 퀴즈는 참가자가 자신이 응시한 문제의 정답·해설을 복습할 수 있다.
--     (여전히 본인이 제출한 퀴즈만 반환하므로 미응시 퀴즈 정답은 새지 않음)
--
-- 하위호환: CREATE OR REPLACE 만. 시그니처 동일. 노출을 넓히는 방향.
--
-- 복구: 172 본문(due_at 조건 없는 버전)으로 CREATE OR REPLACE.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_quiz_review(p_program_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_owner boolean := false;
  v_result jsonb;
BEGIN
  SELECT (owner_id = v_uid) INTO v_is_owner FROM public.programs WHERE id = p_program_id;

  IF NOT (COALESCE(v_is_owner, false) OR v_uid = p_user_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT COALESCE(jsonb_agg(sub ORDER BY (sub->>'submitted_at') DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', s.id,
      'title', q.title,
      'total_score', s.total_score,
      'status', s.status,
      'submitted_at', s.submitted_at,
      'reveal', (v_is_owner OR q.reveal_answers OR (q.due_at IS NOT NULL AND q.due_at < now())),
      'answers', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'text', qq.question_text,
          'type', qq.type,
          'order', qq.order_index,
          'userAnswer', a.answer,
          'isCorrect', a.is_correct,
          'point', qq.point,
          'awarded', a.awarded_point,
          'correctAnswer', CASE WHEN (v_is_owner OR q.reveal_answers OR (q.due_at IS NOT NULL AND q.due_at < now())) THEN qq.correct_answer ELSE NULL END,
          'explanation',   CASE WHEN (v_is_owner OR q.reveal_answers OR (q.due_at IS NOT NULL AND q.due_at < now())) THEN qq.explanation   ELSE NULL END
        ) ORDER BY qq.order_index)
        FROM public.quiz_answers a
        JOIN public.quiz_questions qq ON qq.id = a.question_id
        WHERE a.submission_id = s.id
      ), '[]'::jsonb)
    ) AS sub
    FROM public.quiz_submissions s
    JOIN public.quizzes q ON q.id = s.quiz_id
    WHERE q.program_id = p_program_id AND s.user_id = p_user_id
  ) t;

  RETURN v_result;
END;
$$;
