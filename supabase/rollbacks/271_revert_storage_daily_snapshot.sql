-- ============================================================
-- Rollback: 271 - 저장소 스냅샷·전일 값 되돌리기
-- 작성일: 2026-09-22
-- 되돌리는 것: 두 함수를 268/256 시점 동작으로 복원.
--   admin_totals_daily 에 이미 쌓인 storage 키는 그냥 남겨둔다(무해, 읽는 쪽이 없어짐).
-- ============================================================

-- 스냅샷: 268 버전 (집계 8키만)
CREATE OR REPLACE FUNCTION public.snapshot_admin_totals()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  INSERT INTO public.admin_totals_daily (snapshot_date, totals)
  VALUES (v_today, public.admin_totals_now())
  ON CONFLICT (snapshot_date)
  DO UPDATE SET totals = EXCLUDED.totals, created_at = now();
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.snapshot_admin_totals() FROM anon, authenticated, PUBLIC;

-- 용량 현황: 256 버전 (prev 없음)
CREATE OR REPLACE FUNCTION public.admin_capacity()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_state   public.capacity_alert_state;
  v_storage BIGINT;
  v_db      BIGINT;
  v_buckets JSONB;
BEGIN
  IF NOT public.is_admin() THEN RETURN NULL; END IF;
  SELECT * INTO v_state FROM public.capacity_alert_state WHERE id = 1;
  SELECT coalesce(sum(nullif(o.metadata->>'size', '')::BIGINT), 0)
    INTO v_storage FROM storage.objects o;
  v_db := pg_database_size(current_database());
  SELECT coalesce(
           jsonb_agg(jsonb_build_object('bucket', t.bucket_id, 'objects', t.objects, 'bytes', t.bytes)
                     ORDER BY t.bytes DESC), '[]'::JSONB)
    INTO v_buckets FROM public.get_storage_usage() t;
  RETURN jsonb_build_object(
    'storage_bytes', v_storage, 'storage_limit', v_state.storage_limit_bytes,
    'storage_band', v_state.storage_last_band, 'db_bytes', v_db,
    'db_limit', v_state.db_limit_bytes, 'db_band', v_state.db_last_band,
    'last_checked_at', v_state.last_checked_at, 'buckets', v_buckets);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.admin_capacity() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_capacity() FROM anon, PUBLIC;
