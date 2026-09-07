-- 256 되돌리기 — 관리자 콘솔 RPC 제거.
-- 조회 전용 함수만 지우므로 데이터 영향 없음.
-- ⚠️ /admin 화면이 배포된 상태에서 지우면 그 화면이 에러를 낸다. 코드 롤백을 먼저 할 것.

DROP FUNCTION IF EXISTS public.admin_alerts();
DROP FUNCTION IF EXISTS public.admin_operators();
DROP FUNCTION IF EXISTS public.admin_activity(INT);
DROP FUNCTION IF EXISTS public.admin_totals();
DROP FUNCTION IF EXISTS public.admin_capacity();
