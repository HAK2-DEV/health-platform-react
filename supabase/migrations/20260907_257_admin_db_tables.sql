-- ============================================================
-- Migration: 257 - 관리자 콘솔: DB 테이블별 크기 조회
-- 작성일: 2026-09-07
-- 설명:
--   256 의 admin_capacity() 는 DB «총량» 만 준다.
--   실측 결과 DB 가 275MB/500MB(55%)로 스토리지(13.5%)보다 훨씬 차 있는데,
--   무엇이 차지하는지 볼 방법이 없어 「저장소 상세」와 대칭으로 「DB 상세」를 추가한다.
--
--   pg_catalog 를 포함한 «모든» 스키마를 본다. 확장 테이블이 범인인 경우가 많아서인데,
--   이 프로젝트의 실측 결과(2026-09-07)는 달랐다:
--     public.foods         253 MB / 321,469행  ← DB 전체의 92%. 식단 검색용 음식 DB.
--     net._http_response   640 kB / 8행        ← 자동 정리되고 있었다(누명)
--     cron.job_run_details 25위 밖
--   즉 운영 데이터(인증 248kB·프로그램 256kB)는 미미하고, 정적 참조 데이터 하나가 대부분이다.
--   → 남은 여유가 작으므로 foods 의 테이블/인덱스 비중을 따로 볼 것.
--
--   크기는 pg_total_relation_size(본체 + 인덱스 + TOAST).
--   행 수는 reltuples(통계 기반 근사) — ANALYZE 전이면 -1 이라 0 으로 보정.
--
-- 영향:
--   조회 전용 함수 1개 추가. 기존 테이블/정책 변경 없음.
--
-- 복구:
--   supabase/rollbacks/257_revert_admin_db_tables.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_db_tables(p_limit INT DEFAULT 20)
RETURNS TABLE (
  schema_name TEXT,
  table_name  TEXT,
  bytes       BIGINT,
  approx_rows BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT n.nspname::TEXT,
         c.relname::TEXT,
         pg_total_relation_size(c.oid)::BIGINT,
         greatest(c.reltuples, 0)::BIGINT
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE public.is_admin()
    AND c.relkind IN ('r', 'm', 'p')          -- 일반/구체화뷰/파티션 테이블
    AND n.nspname <> 'information_schema'
  ORDER BY 3 DESC
  LIMIT greatest(coalesce(p_limit, 20), 1);
$fn$;

REVOKE ALL ON FUNCTION public.admin_db_tables(INT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_db_tables(INT) TO authenticated;

-- ── 진단용 즉시 조회 ─────────────────────────────────────
--   SQL 에디터에서 이 파일을 통째로 실행하면 아래 결과가 바로 뜬다.
--   (함수와 달리 is_admin() 가드가 없는 «직접 조회» — 에디터는 postgres 로 실행되므로)
SELECT n.nspname                       AS schema_name,
       c.relname                       AS table_name,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
       greatest(c.reltuples, 0)::BIGINT AS approx_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'm', 'p')
  AND n.nspname <> 'information_schema'
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 25;
