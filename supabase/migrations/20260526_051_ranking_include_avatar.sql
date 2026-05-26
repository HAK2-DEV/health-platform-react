-- ============================================================
-- Migration: 051 - get_program_ranking 에 avatar_path 추가
-- 작성일: 2026-05-26
-- 설명: 랭킹 행에 아바타 URL 을 함께 반환 → 클라이언트에서 N+1 fetch 없이 한 번에 표시.
--   기존 RETURNS TABLE 시그니처에 avatar_path 컬럼 추가.
--   SECURITY DEFINER 그대로 — RLS 우회 정책 유지.
--
-- 복구:
--   supabase/rollbacks/051_revert_ranking_include_avatar.sql 수동 실행 → 024 시점 시그니처 복원.
-- ============================================================

-- DROP 먼저 — RETURNS TABLE 시그니처 변경은 REPLACE 불가
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
