-- ============================================================
-- Migration: 059 - get_program_ranking 에 시간 범위 필터 추가
-- 작성일: 2026-05-26
-- 설명: 랭킹 시간 범위 토글(전체/이번 주/이번 달)을 지원하기 위해
--       p_period_start TIMESTAMPTZ 인자를 추가. NULL 이면 전체 기간(기존 동작).
--       값이 있으면 score_ledgers.created_at >= p_period_start 인 점수만 합산.
--
-- 시그니처 변경 (인자 추가) → DROP 먼저 후 CREATE.
-- 클라이언트는 NULL 또는 ISO 문자열로 전달.
--
-- 복구:
--   supabase/rollbacks/059_revert_ranking_period_filter.sql 수동 실행 → 051 시점 시그니처 복원.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_program_ranking(UUID);
DROP FUNCTION IF EXISTS public.get_program_ranking(UUID, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_program_ranking(
  p_program_id UUID,
  p_period_start TIMESTAMPTZ DEFAULT NULL
)
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
    AND (p_period_start IS NULL OR sl.created_at >= p_period_start)
  WHERE pp.program_id = p_program_id
    AND pp.status = 'ACTIVE'
  GROUP BY pp.user_id, u.nickname, u.avatar_path
  ORDER BY rank, u.nickname;
$$;

GRANT EXECUTE ON FUNCTION public.get_program_ranking(UUID, TIMESTAMPTZ) TO authenticated;
