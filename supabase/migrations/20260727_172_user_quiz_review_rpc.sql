-- ============================================================
-- Migration: 172 - 유저 퀴즈 리뷰 RPC (참가자 본인/운영자 문항별 결과)
-- 작성일: 2026-07-27
-- 설명:
--   quiz_questions 는 owner/admin 만 직접 SELECT 가능(063 RLS, 정답 노출 방지).
--   → 참가자는 본인이 응시한 퀴즈의 문항 텍스트조차 임베드로 못 읽어, 「내 퀴즈 기록」
--     문항별 딥드릴이 비어 보였다. 이를 위한 SECURITY DEFINER RPC.
--
--   get_user_quiz_review(program_id, user_id): 대상 유저의 제출 퀴즈별 문항 답안 반환.
--     · 권한: 프로그램 owner 또는 본인(auth.uid()=user_id) 만.
--     · 문항 텍스트·내 답·정오답·배점은 항상 반환.
--     · 정답(correct_answer)·해설(explanation)은 owner 이거나 quiz.reveal_answers=true 일 때만.
--       (reveal_answers OFF 퀴즈는 참가자에게 정답 비공개 정책 유지)
--
-- 하위호환: 신규 함수 추가만. 기존 동작 불변. authenticated EXECUTE.
--
-- 복구: DROP FUNCTION IF EXISTS public.get_user_quiz_review(uuid, uuid);
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
      'reveal', (v_is_owner OR q.reveal_answers),
      'answers', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'text', qq.question_text,
          'type', qq.type,
          'order', qq.order_index,
          'userAnswer', a.answer,
          'isCorrect', a.is_correct,
          'point', qq.point,
          'awarded', a.awarded_point,
          'correctAnswer', CASE WHEN (v_is_owner OR q.reveal_answers) THEN qq.correct_answer ELSE NULL END,
          'explanation',   CASE WHEN (v_is_owner OR q.reveal_answers) THEN qq.explanation   ELSE NULL END
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

GRANT EXECUTE ON FUNCTION public.get_user_quiz_review(uuid, uuid) TO authenticated;
