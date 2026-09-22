-- ============================================================
-- Rollback: 268 - 관리자 콘솔 전일 대비 증감
-- 작성일: 2026-09-22
-- 되돌리는 것: cron 해제 → admin_totals() 를 256 버전(누적 8키)으로 복원
--              → 보조 함수·스냅샷 테이블 제거.
-- ⚠️ 클라이언트가 prev 를 쓰는 상태에서 되돌리면 증감 배지만 사라진다(값은 정상).
-- ============================================================

DO $do$
BEGIN
  PERFORM cron.unschedule('snapshot-admin-totals') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'snapshot-admin-totals'
  );
EXCEPTION WHEN others THEN NULL;
END $do$;

-- 256 원본으로 복원
CREATE OR REPLACE FUNCTION public.admin_totals()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT CASE WHEN public.is_admin() THEN jsonb_build_object(
    'users',         (SELECT count(*) FROM public.users),
    'programs',      (SELECT count(*) FROM public.programs),
    'published',     (SELECT count(*) FROM public.programs WHERE status = 'PUBLISHED'),
    'participants',  (SELECT count(*) FROM public.program_participants WHERE status = 'ACTIVE'),
    'verifications', (SELECT count(*) FROM public.verifications),
    'posts',         (SELECT count(*) FROM public.community_posts),
    'push_subs',     (SELECT count(*) FROM public.push_subscriptions),
    'sessions',      (SELECT count(*) FROM public.sessions)
  ) ELSE NULL END;
$fn$;
GRANT EXECUTE ON FUNCTION public.admin_totals() TO authenticated;

DROP FUNCTION IF EXISTS public.admin_totals_as_of(DATE);
DROP FUNCTION IF EXISTS public.snapshot_admin_totals();
DROP FUNCTION IF EXISTS public.admin_totals_now();
DROP TABLE IF EXISTS public.admin_totals_daily;
