-- ============================================================
-- Migration: 127 - 팀 랭킹 RPC (get_team_ranking)
-- 작성일: 2026-06-24
-- 설명:
--   팀 랭킹을 team_members 의 개인 점수(score_ledgers)로 항상 라이브 집계.
--   팀 점수는 저장하지 않음(126 설계). 개인 랭킹 get_program_ranking(059) 과
--   동일 패턴: SECURITY DEFINER + p_period_start 기간 필터(주간/월간) 재사용.
--
--   반환: 팀별 합계(total_score)·인당 평균(avg_score)·인원·정원·멤버목록(members),
--         활성 여부(is_active)와 순위(rank).
--   - 활성(랭킹 반영) 기준:
--       fixed 정책 → 인원 >= team_size_fixed (풀멤버 차야 활성)
--       range 정책 → 인원 >= team_size_min (기본 2명부터)
--   - 순위(rank)는 활성 팀끼리만 매김(비활성=모집중은 rank NULL).
--   - 정렬 점수는 programs.team_score_mode: 'average' → 인당 평균, 그 외 → 합계.
--   - members: [{user_id, nickname, avatar_path, score}] 점수 내림차순 JSON 배열.
--
--   읽기 전용 집계 함수(추가만) — 기존 동작에 영향 없음.
--
-- 복구: DROP FUNCTION public.get_team_ranking(UUID, TIMESTAMPTZ);
-- ============================================================

DROP FUNCTION IF EXISTS public.get_team_ranking(UUID, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_team_ranking(
  p_program_id UUID,
  p_period_start TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  team_id UUID,
  team_name TEXT,
  emoji TEXT,
  leader_id UUID,
  member_count INT,
  capacity INT,
  total_score INT,
  avg_score NUMERIC,
  is_active BOOLEAN,
  rank INT,
  members JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH prog AS (
    SELECT
      COALESCE(team_size_type, 'range')     AS size_type,
      COALESCE(team_size_min, 2)            AS size_min,
      team_size_fixed                       AS size_fixed,
      COALESCE(team_score_mode, 'sum')      AS score_mode
    FROM public.programs
    WHERE id = p_program_id
  ),
  member_scores AS (
    SELECT sl.user_id, COALESCE(SUM(sl.point), 0)::int AS score
    FROM public.score_ledgers sl
    WHERE sl.program_id = p_program_id
      AND (p_period_start IS NULL OR sl.created_at >= p_period_start)
    GROUP BY sl.user_id
  ),
  team_agg AS (
    SELECT
      t.id, t.name, t.emoji, t.leader_id, t.capacity,
      COUNT(tm.user_id)::int AS member_count,
      COALESCE(SUM(ms.score), 0)::int AS total_score,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'user_id', u.id,
            'nickname', u.nickname,
            'avatar_path', u.avatar_path,
            'score', COALESCE(ms.score, 0)
          ) ORDER BY COALESCE(ms.score, 0) DESC, u.nickname
        ) FILTER (WHERE tm.user_id IS NOT NULL),
        '[]'::jsonb
      ) AS members
    FROM public.teams t
    LEFT JOIN public.team_members tm ON tm.team_id = t.id
    LEFT JOIN public.users u ON u.id = tm.user_id
    LEFT JOIN member_scores ms ON ms.user_id = tm.user_id
    WHERE t.program_id = p_program_id
    GROUP BY t.id, t.name, t.emoji, t.leader_id, t.capacity
  ),
  flagged AS (
    SELECT
      ta.*,
      prog.score_mode,
      CASE
        WHEN prog.size_type = 'fixed'
          THEN ta.member_count >= COALESCE(prog.size_fixed, 2147483647)
        ELSE ta.member_count >= prog.size_min
      END AS is_active,
      ROUND(ta.total_score::numeric / NULLIF(ta.member_count, 0), 1) AS avg_score
    FROM team_agg ta CROSS JOIN prog
  )
  SELECT
    f.id AS team_id,
    f.name AS team_name,
    f.emoji,
    f.leader_id,
    f.member_count,
    f.capacity,
    f.total_score,
    COALESCE(f.avg_score, 0) AS avg_score,
    f.is_active,
    CASE WHEN f.is_active THEN
      RANK() OVER (
        PARTITION BY f.is_active
        ORDER BY (CASE WHEN f.score_mode = 'average' THEN COALESCE(f.avg_score, 0) ELSE f.total_score END) DESC
      )::int
    END AS rank,
    f.members
  FROM flagged f
  ORDER BY
    f.is_active DESC,
    (CASE WHEN f.score_mode = 'average' THEN COALESCE(f.avg_score, 0) ELSE f.total_score END) DESC,
    f.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_ranking(UUID, TIMESTAMPTZ) TO authenticated;
