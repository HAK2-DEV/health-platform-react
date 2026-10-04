-- ============================================================
-- Rollback: 278 - 서비스 현황 «댓글» 집계 되돌리기
-- ============================================================
-- 268 의 정의로 되돌린다(comments 키 제거).
-- ⚠️ 화면(AdminConsolePage 의 「댓글」 타일)이 아직 라이브면 숫자가 0 으로 보인다.
--    코드를 먼저 되돌리고 이 파일을 적용할 것.
-- ⚠️ 이미 저장된 스냅샷의 comments 키는 남는다(무해 — 아무도 읽지 않는다).

CREATE OR REPLACE FUNCTION public.admin_totals_now()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'users',         (SELECT count(*) FROM public.users),
    'programs',      (SELECT count(*) FROM public.programs),
    'published',     (SELECT count(*) FROM public.programs WHERE status = 'PUBLISHED'),
    'participants',  (SELECT count(*) FROM public.program_participants WHERE status = 'ACTIVE'),
    'verifications', (SELECT count(*) FROM public.verifications),
    'posts',         (SELECT count(*) FROM public.community_posts),
    'push_subs',     (SELECT count(*) FROM public.push_subscriptions),
    'sessions',      (SELECT count(*) FROM public.sessions)
  );
$fn$;

CREATE OR REPLACE FUNCTION public.admin_totals_as_of(p_date DATE)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH cut AS (
    SELECT ((p_date + 1)::timestamp AT TIME ZONE 'Asia/Seoul') AS ts
  )
  SELECT jsonb_build_object(
    'users',         (SELECT count(*) FROM public.users u, cut WHERE u.created_at < cut.ts),
    'programs',      (SELECT count(*) FROM public.programs p, cut WHERE p.created_at < cut.ts),
    'published',     (SELECT count(*) FROM public.programs p, cut
                       WHERE p.status = 'PUBLISHED' AND p.published_at IS NOT NULL AND p.published_at < cut.ts),
    'participants',  (SELECT count(*) FROM public.program_participants pp, cut
                       WHERE pp.status = 'ACTIVE' AND pp.joined_at < cut.ts),
    'verifications', (SELECT count(*) FROM public.verifications v, cut WHERE v.submitted_at < cut.ts),
    'posts',         (SELECT count(*) FROM public.community_posts c, cut WHERE c.created_at < cut.ts),
    'push_subs',     (SELECT count(*) FROM public.push_subscriptions s, cut WHERE s.created_at < cut.ts),
    'sessions',      (SELECT count(*) FROM public.sessions s, cut WHERE s.created_at < cut.ts)
  );
$fn$;

REVOKE ALL ON FUNCTION public.admin_totals_now()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_totals_as_of(DATE)  FROM PUBLIC, anon, authenticated;
