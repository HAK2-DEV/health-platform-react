-- ============================================================
-- Rollback: 279 - 「14일 활동」의 일일 접속자(DAU) 되돌리기
-- ============================================================
-- 256 의 정의(3개 컬럼)로 되돌린다.
-- ⚠️ 화면(AdminConsolePage 의 접속자 막대)이 아직 라이브면 접속자 줄이 0 으로 보인다.
--    코드를 먼저 되돌리고 이 파일을 적용할 것.
-- ⚠️ 인덱스 idx_screen_events_created_at 은 남긴다(조회 성능에 도움, 되돌릴 이유 없음).
--    굳이 지우려면 맨 아래 줄의 주석을 풀 것.

DROP FUNCTION IF EXISTS public.admin_activity(INT);

CREATE OR REPLACE FUNCTION public.admin_activity(p_days INT DEFAULT 14)
RETURNS TABLE (day DATE, verify_count BIGINT, post_count BIGINT, join_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH span AS (
    SELECT generate_series(
      (now() AT TIME ZONE 'Asia/Seoul')::date - (greatest(coalesce(p_days, 14), 1) - 1),
      (now() AT TIME ZONE 'Asia/Seoul')::date,
      interval '1 day')::date AS dd
  )
  SELECT s.dd,
    (SELECT count(*) FROM public.verifications v
      WHERE (v.submitted_at AT TIME ZONE 'Asia/Seoul')::date = s.dd)::BIGINT,
    (SELECT count(*) FROM public.community_posts c
      WHERE (c.created_at AT TIME ZONE 'Asia/Seoul')::date = s.dd)::BIGINT,
    (SELECT count(*) FROM public.program_participants pp
      WHERE (pp.joined_at AT TIME ZONE 'Asia/Seoul')::date = s.dd)::BIGINT
  FROM span s
  WHERE public.is_admin()
  ORDER BY s.dd;
$fn$;

REVOKE ALL ON FUNCTION public.admin_activity(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_activity(INT) TO authenticated;

-- DROP INDEX IF EXISTS public.idx_screen_events_created_at;
