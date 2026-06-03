-- ============================================================
-- Rollback: 071 - 랭킹 변동 history 제거
-- 작성일: 2026-06-03
-- 적용:
--   본인이 명시적으로 071 마이그레이션을 되돌리고 싶을 때 수동 실행.
--   복구 후에는 클라이언트 fetchMyRankChange / RPC get_my_rank_change 호출 불가.
--
-- 주의:
--   - cron 작업 unschedule 먼저
--   - 함수 → 테이블 순서로 DROP (의존성 역순)
--   - pg_cron extension 자체는 그대로 둠 (다른 곳에서 사용 가능)
-- ============================================================

-- cron 스케줄 제거 (없어도 안전)
DO $$
BEGIN
  PERFORM cron.unschedule('snapshot-rankings-daily') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'snapshot-rankings-daily'
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 함수 제거
DROP FUNCTION IF EXISTS public.get_my_rank_change(UUID);
DROP FUNCTION IF EXISTS public.snapshot_all_active_programs();
DROP FUNCTION IF EXISTS public.snapshot_program_rankings(UUID);

-- 테이블 제거 (CASCADE 로 정책도 함께)
DROP TABLE IF EXISTS public.rank_snapshots CASCADE;
