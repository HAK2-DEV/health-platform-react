-- ============================================================
-- Migration: 271 - 저장소·DB 용량도 일일 스냅샷에 담아 전일 대비 증감 표시
-- 작성일: 2026-09-22
-- 설명:
--   268 이 「서비스 현황」 8개 타일의 전일 대비 증감을 붙였다. 같은 화면의
--   「저장소 상세」(버킷별 개수·용량)와 DB 크기에도 같은 표시를 원한다.
--
--   ⚠️ 용량은 «되짚기» 가 불가능하다. 파일 크기·개수는 created_at 으로 과거 시점을
--      재계산할 수 없고(삭제된 파일은 흔적이 없다), capacity_alert_state 는 최신값
--      한 벌만 덮어쓴다. → 스냅샷을 쌓는 수밖에 없다.
--
--   1) snapshot_admin_totals() 확장 — admin_totals_daily.totals 에 아래 키를 «추가» 한다.
--        'storage_bytes' · 'db_bytes' · 'buckets' [{bucket, objects, bytes}]
--      기존 8개 키는 그대로 → 268 의 전일 비교는 영향 없다.
--   2) admin_capacity() 확장 — 'prev'(전일 스냅샷의 위 세 값) · 'prev_date' 를 추가.
--      전일 스냅샷이 없으면 prev 는 NULL → 화면은 증감을 감추면 된다(되짚기 없음).
--   3) 적용 직후 오늘 자 스냅샷을 다시 기록해 저장소 기준선을 남긴다.
--      → 내일(KST 00:05) 스냅샷부터 저장소 증감이 실제로 표시된다.
--
--   ⚠️ 270 이후 규칙: 새 함수·변경 함수는 anon 에 부여하지 않는다.
--      여기서는 기존 함수만 교체하므로 권한은 그대로다(admin_capacity 는 authenticated,
--      내부 함수 snapshot_admin_totals·get_storage_usage 는 이미 회수된 상태).
--
-- 영향:
--   함수 2개 교체 + 오늘 자 스냅샷 1행 갱신. 테이블·정책·권한 변경 없음.
--   구버전 화면도 그대로 동작한다(반환 키를 추가만 함).
--
-- 복구: supabase/rollbacks/271_revert_storage_daily_snapshot.sql
-- ============================================================

-- ── 1) 스냅샷에 저장소·DB 용량 추가 ──────────────────────
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

  SELECT coalesce(
           jsonb_agg(jsonb_build_object(
             'bucket', t.bucket_id, 'objects', t.objects, 'bytes', t.bytes
           ) ORDER BY t.bytes DESC), '[]'::JSONB)
    INTO v_buckets FROM public.get_storage_usage() t;

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

-- ── 2) 용량 현황에 전일 값 동봉 ──────────────────────────
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
  v_yday    DATE := (now() AT TIME ZONE 'Asia/Seoul')::date - 1;
  v_prev    JSONB;
BEGIN
  IF NOT public.is_admin() THEN RETURN NULL; END IF;

  SELECT * INTO v_state FROM public.capacity_alert_state WHERE id = 1;

  SELECT coalesce(sum(nullif(o.metadata->>'size', '')::BIGINT), 0)
    INTO v_storage FROM storage.objects o;

  v_db := pg_database_size(current_database());

  SELECT coalesce(
           jsonb_agg(jsonb_build_object(
             'bucket', t.bucket_id, 'objects', t.objects, 'bytes', t.bytes
           ) ORDER BY t.bytes DESC), '[]'::JSONB)
    INTO v_buckets FROM public.get_storage_usage() t;

  -- 전일 스냅샷 (저장소 키가 담긴 행만 의미가 있다 — 271 적용 전 행에는 없다)
  SELECT jsonb_build_object(
           'storage_bytes', d.totals->'storage_bytes',
           'db_bytes',      d.totals->'db_bytes',
           'buckets',       d.totals->'buckets'
         )
    INTO v_prev
  FROM public.admin_totals_daily d
  WHERE d.snapshot_date = v_yday AND d.totals ? 'buckets';

  RETURN jsonb_build_object(
    'storage_bytes',   v_storage,
    'storage_limit',   v_state.storage_limit_bytes,
    'storage_band',    v_state.storage_last_band,
    'db_bytes',        v_db,
    'db_limit',        v_state.db_limit_bytes,
    'db_band',         v_state.db_last_band,
    'last_checked_at', v_state.last_checked_at,
    'buckets',         v_buckets,
    'prev',            v_prev,          -- 없으면 NULL → 화면은 증감을 숨긴다
    'prev_date',       v_yday
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.admin_capacity() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_capacity() FROM anon, PUBLIC;

-- ── 3) 오늘 자 저장소 기준선 (내일부터 증감 표시) ────────
SELECT public.snapshot_admin_totals();
