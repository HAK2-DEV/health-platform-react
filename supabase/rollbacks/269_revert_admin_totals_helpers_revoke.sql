-- ============================================================
-- Rollback: 269 - 보조 함수 권한 차단 되돌리기
-- 작성일: 2026-09-22
-- ⚠️ 되돌리면 익명·로그인 사용자가 서비스 집계를 읽고 스냅샷을 쓸 수 있게 된다.
--    되돌릴 이유가 거의 없다 — 268 자체를 내릴 때는 rollbacks/268 을 쓸 것.
-- ============================================================

GRANT EXECUTE ON FUNCTION public.admin_totals_now()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_totals_as_of(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_admin_totals()  TO authenticated;
