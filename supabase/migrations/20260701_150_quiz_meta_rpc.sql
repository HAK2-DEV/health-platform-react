-- ============================================================
-- Migration: 150 - 퀴즈 메타 집계 RPC (참여자용)
-- 작성일: 2026-07-01
-- 설명:
--   quiz_questions 는 owner/admin 만 직접 SELECT 가능(063 RLS) → 참여자는 문항 수·점수를
--   알 수 없어 목록 카드에 "0문제/+0P" 로 표시됨.
--   get_program_quiz_meta(p_program_id): SECURITY DEFINER 로 정답·문항내용은 노출하지 않고
--   퀴즈별 문항 수 / 총점 / 유형별 개수(JSONB)만 반환. 프로그램 접근 권한 있는 사용자만.
--
-- 복구:
--   DROP FUNCTION IF EXISTS public.get_program_quiz_meta(UUID);
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_program_quiz_meta(p_program_id UUID)
RETURNS TABLE(quiz_id UUID, question_count INT, total_point INT, type_counts JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    q.id,
    COALESCE((SELECT COUNT(*) FROM public.quiz_questions qq WHERE qq.quiz_id = q.id), 0)::int,
    COALESCE((SELECT SUM(qq.point) FROM public.quiz_questions qq WHERE qq.quiz_id = q.id), 0)::int,
    COALESCE(
      (SELECT jsonb_object_agg(t.type, t.cnt)
         FROM (SELECT qq.type, COUNT(*) AS cnt
                 FROM public.quiz_questions qq
                WHERE qq.quiz_id = q.id
                GROUP BY qq.type) t),
      '{}'::jsonb
    )
  FROM public.quizzes q
  JOIN public.programs p ON p.id = q.program_id
  WHERE q.program_id = p_program_id
    AND (
      public.is_admin()
      OR p.owner_id = auth.uid()
      OR (p.status = 'PUBLISHED' AND p.is_public = true)
      OR EXISTS (
        SELECT 1 FROM public.program_participants pp
        WHERE pp.program_id = p.id AND pp.user_id = auth.uid() AND pp.status = 'ACTIVE'
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_program_quiz_meta(UUID) TO authenticated;
