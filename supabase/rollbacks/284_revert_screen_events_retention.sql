-- ============================================================
-- Rollback: 284 - screen_events 보관 기간 되돌리기
-- 주의: 이미 지워진 행은 돌아오지 않는다. 이 되돌리기는 «앞으로 안 지우게» 할 뿐이다.
-- ============================================================

DO $$
BEGIN
  PERFORM cron.unschedule('purge-screen-events') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'purge-screen-events'
  );
END $$;

DROP FUNCTION IF EXISTS public.purge_old_screen_events(INT, INT);
