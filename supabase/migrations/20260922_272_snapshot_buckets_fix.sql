-- ============================================================
-- Migration: 272 - 스냅샷의 버킷 집계가 «항상 0개» 로 저장되던 문제
-- 작성일: 2026-09-22
-- 설명:
--   🔴 271 적용 직후 실측: admin_totals_daily 의 오늘 행에 'buckets' 가 [] 로 들어갔다.
--      원인은 `get_storage_usage()` 안의 `WHERE public.is_admin()` —
--      화면(admin_capacity)은 관리자가 호출하니 정상이지만,
--      **스냅샷은 cron(postgres) 이 부르므로 is_admin() 이 false → 0행**.
--      SECURITY DEFINER 라도 auth.uid() 는 «호출한 사람» 기준이라 NULL 이다.
--
--   → 스냅샷은 가드가 걸린 함수를 거치지 않고 storage.objects 를 직접 집계한다.
--      (스냅샷 함수 자체가 이미 내부 전용이고 270 에서 anon·authenticated 회수됨)
--
--   ⚠️ 교훈: 내부 집계 함수를 «관리자 가드가 있는 함수» 로 조립하면 조용히 빈 값이 된다.
--      값이 비어도 에러가 아니라 더 위험하다 — 스냅샷은 적용 후 실제 행을 눈으로 확인할 것.
--
-- 영향:
--   snapshot_admin_totals() 본문만 교체. 오늘 자 행을 다시 기록해 기준선을 바로잡는다.
--
-- 복구: supabase/rollbacks/271_revert_storage_daily_snapshot.sql (271 로 되돌리면 이 수정도 사라짐)
-- ============================================================

CREATE OR REPLACE FUNCTION public.snapshot_admin_totals()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_today   DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_storage BIGINT;
  v_buckets JSONB;
BEGIN
  SELECT coalesce(sum(nullif(o.metadata->>'size', '')::BIGINT), 0)
    INTO v_storage FROM storage.objects o;

  -- 가드 없는 직접 집계 (get_storage_usage() 는 is_admin() 가드가 있어 cron 에서 0행)
  SELECT coalesce(
           jsonb_agg(t ORDER BY (t->>'bytes')::BIGINT DESC), '[]'::JSONB)
    INTO v_buckets
  FROM (
    SELECT jsonb_build_object(
             'bucket',  o.bucket_id,
             'objects', count(*)::BIGINT,
             'bytes',   coalesce(sum(nullif(o.metadata->>'size', '')::BIGINT), 0)::BIGINT
           ) AS t
    FROM storage.objects o
    GROUP BY o.bucket_id
  ) s;

  INSERT INTO public.admin_totals_daily (snapshot_date, totals)
  VALUES (
    v_today,
    public.admin_totals_now() || jsonb_build_object(
      'storage_bytes', v_storage,
      'db_bytes',      pg_database_size(current_database()),
      'buckets',       v_buckets
    )
  )
  ON CONFLICT (snapshot_date)
  DO UPDATE SET totals = EXCLUDED.totals, created_at = now();
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.snapshot_admin_totals() FROM anon, authenticated, PUBLIC;

-- 오늘 자 기준선 다시 기록 (버킷이 실제로 담기는지 확인용)
SELECT public.snapshot_admin_totals();

-- 확인: 아래가 5개 버킷을 보여야 한다
--   SELECT snapshot_date, jsonb_array_length(totals->'buckets') AS buckets,
--          totals->'storage_bytes' AS storage_bytes
--   FROM public.admin_totals_daily ORDER BY snapshot_date DESC LIMIT 2;
