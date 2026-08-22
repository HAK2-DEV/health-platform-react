-- ============================================================
-- Migration: 241 - 랭킹 조회 인가(Authorization) 게이트
-- 작성일: 2026-08-23
-- 설명:
--   get_program_ranking / get_team_ranking (SECURITY DEFINER, authenticated) 이
--   호출자가 해당 프로그램 참여자/소유자인지 확인 없이 program_id 만으로 랭킹
--   (닉네임·아바타·점수·팀·멤버)을 반환했다. → program_id 만 알면 **비공개 프로그램의
--   멤버십·성적이 아무 로그인 사용자에게 유출**(영상 ①엔드포인트별 인가 미비).
--
--   수정: "이 프로그램을 볼 자격이 있나" 헬퍼(_can_view_program)로 게이트.
--     자격 = 관리자 OR 소유자 OR (공개+발행) OR (미리보기허용+발행) OR ACTIVE 참여자 OR 대기 참여자.
--     (programs SELECT RLS 007/054/087/237 과 동일 접근 모델)
--   무자격 호출은 빈 결과. 정당한 호출자(참여자·소유자·공개 둘러보기·admin)는 영향 없음.
--
-- 하위호환: 클라 호출 경로(참여자/소유자/공개열람)는 그대로 동작. 함수 시그니처 불변.
-- 복구: 041 이전 함수 본문으로 CREATE OR REPLACE (게이트 제거).
-- ============================================================

-- ── 프로그램 열람 자격 헬퍼 ────────────────────────────────
CREATE OR REPLACE FUNCTION public._can_view_program(p_program_id UUID, p_user UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.programs p WHERE p.id = p_program_id AND (
        p.owner_id = p_user
        OR (p.status = 'PUBLISHED' AND p.is_public = true)
        OR (p.status = 'PUBLISHED' AND p.preview_enabled = true)
      )
    )
    OR public._is_active_participant(p_program_id, p_user)
    OR public._is_pending_participant(p_program_id, p_user);
$$;
GRANT EXECUTE ON FUNCTION public._can_view_program(UUID, UUID) TO authenticated;

-- ── get_program_ranking (게이트 추가) ─────────────────────
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
    AND public._can_view_program(p_program_id, auth.uid())   -- ← 인가 게이트
  GROUP BY pp.user_id, u.nickname, u.avatar_path
  ORDER BY rank, u.nickname;
$$;
GRANT EXECUTE ON FUNCTION public.get_program_ranking(UUID, TIMESTAMPTZ) TO authenticated;

-- ── get_team_ranking (게이트 추가) ────────────────────────
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
  WHERE public._can_view_program(p_program_id, auth.uid())   -- ← 인가 게이트
  ORDER BY
    f.is_active DESC,
    (CASE WHEN f.score_mode = 'average' THEN COALESCE(f.avg_score, 0) ELSE f.total_score END) DESC,
    f.name;
$$;
GRANT EXECUTE ON FUNCTION public.get_team_ranking(UUID, TIMESTAMPTZ) TO authenticated;
