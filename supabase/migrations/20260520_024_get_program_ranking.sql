-- ============================================================
-- Migration: 024 - get_program_ranking 함수
-- 작성일: 2026-05-20
-- 설명: 프로그램의 참여자 랭킹 산출. SSRD F-RANK-010/020 구현.
--
-- SECURITY DEFINER 로 RLS 우회 (참여자 본인은 다른 참여자의
--   score_ledgers/program_participants 를 직접 SELECT 못 함).
--   함수가 안전하게 집계 후 결과만 반환.
--
-- RANK() OVER (ORDER BY total_score DESC):
--   Standard Rank — 동점자에게 같은 순위 부여 후 다음 순위 건너뜀.
--   예: 10점/10점/5점 → 1위, 1위, 3위.
--   SSRD F-RANK-020 "Standard Rank 방식" 명시와 일치.
--
-- 정렬: 점수 내림차순, 동점이면 닉네임 가나다순.
--
-- ranking_snapshots 캐시 테이블은 MVP 2차 (Realtime + 주기적 갱신).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_program_ranking(p_program_id UUID)
RETURNS TABLE (
  user_id UUID,
  nickname TEXT,
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
    COALESCE(SUM(sl.point), 0)::int AS total_score,
    RANK() OVER (ORDER BY COALESCE(SUM(sl.point), 0) DESC)::int AS rank
  FROM public.program_participants pp
  JOIN public.users u ON u.id = pp.user_id
  LEFT JOIN public.score_ledgers sl
    ON sl.user_id = pp.user_id
    AND sl.program_id = pp.program_id
  WHERE pp.program_id = p_program_id
    AND pp.status = 'ACTIVE'
  GROUP BY pp.user_id, u.nickname
  ORDER BY rank, u.nickname;
$$;

-- RPC 호출 허용 (Supabase 클라이언트의 .rpc() 호출용)
GRANT EXECUTE ON FUNCTION public.get_program_ranking(UUID) TO authenticated;
