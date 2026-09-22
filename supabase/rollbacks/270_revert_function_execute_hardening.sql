-- ============================================================
-- Rollback: 270 - 함수 실행 권한 정리 되돌리기
-- 작성일: 2026-09-22
-- ⚠️ 되돌리면 익명 사용자가 다시 public 스키마 함수를 호출할 수 있다.
--    「화면이 깨졌다」면 먼저 어떤 RPC 가 42501 을 냈는지 확인하고
--    그 함수 하나만 `GRANT EXECUTE … TO authenticated` 로 여는 편이 안전하다.
-- ============================================================

-- 기본 권한 복구(앞으로 만드는 함수)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;

-- 전체 복구 (Supabase 기본 상태와 같아진다)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
