-- ============================================================
-- Migration: 269 - 268 보조 함수 실행 권한 차단 (anon·authenticated)
-- 작성일: 2026-09-22
-- 설명:
--   🔴 268 의 보조 함수 3개가 «누구나» 호출 가능한 상태였다(실측 2026-09-22,
--      익명 키로 REST 호출 성공):
--        admin_totals_now()      200 → 서비스 전체 집계 노출(사용자·프로그램 수 등)
--        admin_totals_as_of(date)200 → 임의 날짜 집계 노출
--        snapshot_admin_totals() 204 → 스냅샷 «쓰기» 까지 실행됨
--
--   원인: 268 에서 `REVOKE ALL ... FROM PUBLIC` 만 했다. Supabase 는 public 스키마
--   함수의 EXECUTE 를 `anon`·`authenticated` 역할에 «따로» 기본 부여하므로
--   PUBLIC 에서만 회수해도 두 역할은 그대로 남는다.
--   → 두 역할에서 명시적으로 REVOKE 한다. [[feedback_users_column_grant_2026-09-17]] 와 같은 계열의 함정.
--
--   공개 창구는 admin_totals() «하나뿐» 이고, 그 함수는 내부에서 is_admin() 으로
--   막는다(관리자 아니면 NULL). cron 은 postgres 권한으로 돌아 영향 없다.
--
-- 영향:
--   함수 3개의 권한만 좁힌다. 테이블·정책·반환값 변화 없음.
--   클라이언트는 admin_totals() 만 호출하므로 화면 영향 없음.
--
-- 복구: supabase/rollbacks/269_revert_admin_totals_helpers_revoke.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.admin_totals_now()        FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_totals_as_of(DATE)  FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.snapshot_admin_totals()   FROM anon, authenticated, PUBLIC;

-- 공개 창구는 이것 하나 (내부 is_admin() 가드)
GRANT EXECUTE ON FUNCTION public.admin_totals() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_totals() FROM anon;
