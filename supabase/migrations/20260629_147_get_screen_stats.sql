-- ============================================================
-- Migration: 147 - get_screen_stats RPC (화면 체류 집계 — 관리자 분석 화면용)
-- 작성일: 2026-06-29
-- 설명:
--   screen_events(146) 를 화면별로 집계: 방문수/평균·총·최대 체류시간.
--   SECURITY INVOKER → 146 RLS(관리자만 SELECT) 그대로 적용. 비관리자가 호출하면 0행.
--   p_days: 최근 N일(기본 30).
--
-- 영향: 신규 함수 1개. 기존 동작 불변.
--
-- 복구:
--   DROP FUNCTION IF EXISTS public.get_screen_stats(int);
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_screen_stats(p_days int DEFAULT 30)
RETURNS TABLE (
  screen   text,
  visits   bigint,
  avg_ms   numeric,
  total_ms bigint,
  max_ms   int
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT screen,
         count(*)::bigint            AS visits,
         round(avg(duration_ms))     AS avg_ms,
         sum(duration_ms)::bigint     AS total_ms,
         max(duration_ms)::int        AS max_ms
  FROM public.screen_events
  WHERE created_at >= now() - make_interval(days => greatest(1, p_days))
  GROUP BY screen
  ORDER BY avg(duration_ms) DESC
$$;

GRANT EXECUTE ON FUNCTION public.get_screen_stats(int) TO authenticated;
