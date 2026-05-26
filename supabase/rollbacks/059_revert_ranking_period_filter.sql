-- ============================================================
-- Rollback: 059 - get_program_ranking period_start 인자 제거
-- 051 시점 시그니처로 복원 (avatar_path 포함, period 인자 없음).
-- ============================================================

DROP FUNCTION IF EXISTS public.get_program_ranking(UUID, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_program_ranking(UUID);

CREATE OR REPLACE FUNCTION public.get_program_ranking(p_program_id UUID)
RETURNS TABLE (
  user_id UUID,
  nickname TEXT,
  avatar_path TEXT,
  total_score INT,
  rank INT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pp.user_id,
    u.nickname,
    u.avatar_path,
    COALESCE(SUM(sl.point), 0)::int AS total_score,
    RANK() OVER (ORDER BY COALESCE(SUM(sl.point), 0) DESC)::int AS rank
  FROM public.program_participants pp
  JOIN public.users u ON u.id = pp.user_id
  LEFT JOIN public.score_ledgers sl
    ON sl.user_id = pp.user_id
    AND sl.program_id = pp.program_id
  WHERE pp.program_id = p_program_id
    AND pp.status = 'ACTIVE'
  GROUP BY pp.user_id, u.nickname, u.avatar_path
  ORDER BY rank, u.nickname;
$$;

GRANT EXECUTE ON FUNCTION public.get_program_ranking(UUID) TO authenticated;
