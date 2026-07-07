-- ============================================================
-- Migration: 152 - get_screen_user_stats RPC (화면별 계정 체류 드릴다운 — 관리자 분석)
-- 작성일: 2026-07-07
-- 설명:
--   특정 화면(screen 키)에 대해 "어떤 계정이 얼마나 오래 머물렀는지"를 계정별로 집계.
--   screen_events(146) 를 user_id 로 그룹화 → 닉네임 조인. 총·평균·최대 체류시간 + 방문수 + 마지막 방문.
--   관리자(is_admin())만 데이터 반환 — 비관리자 호출 시 0행. 닉네임 노출 때문에
--   SECURITY DEFINER + is_admin() 가드로 users RLS 우회하되 관리자에게만 허용.
--   총 체류시간(total_ms) 내림차순 → 오래 머문 계정 우선. 상위 100명.
--
-- 영향: 신규 함수 1개. 기존 동작 불변(additive).
--
-- 복구:
--   DROP FUNCTION IF EXISTS public.get_screen_user_stats(text, int);
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_screen_user_stats(p_screen text, p_days int DEFAULT 30)
RETURNS TABLE (
  user_id  uuid,
  nickname text,
  visits   bigint,
  avg_ms   numeric,
  total_ms bigint,
  max_ms   int,
  last_at  timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 관리자만 — 그 외에는 빈 결과
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT e.user_id,
         u.nickname,
         count(*)::bigint          AS visits,
         round(avg(e.duration_ms)) AS avg_ms,
         sum(e.duration_ms)::bigint AS total_ms,
         max(e.duration_ms)::int    AS max_ms,
         max(e.created_at)          AS last_at
  FROM public.screen_events e
  JOIN public.users u ON u.id = e.user_id
  WHERE e.screen = p_screen
    AND e.created_at >= now() - make_interval(days => greatest(1, p_days))
  GROUP BY e.user_id, u.nickname
  ORDER BY sum(e.duration_ms) DESC
  LIMIT 100;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_screen_user_stats(text, int) TO authenticated;
