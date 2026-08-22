-- ============================================================
-- Migration: 240 - users.email 타인 조회 차단 (PII 노출 수정)
-- 작성일: 2026-08-23
-- 설명:
--   users SELECT 정책이 "authenticated USING(true)" 라 로그인한 누구나 모든 사용자의
--   행을 읽을 수 있고, 테이블에 email 컬럼이 있어 **타인의 이메일까지 조회 가능**했다
--   (스팸·피싱 표적). 출시 전 보안 점검(인가/PII)에서 발견.
--
--   RLS 는 행 단위라 컬럼을 못 숨김 → **컬럼 권한**으로 처리:
--     authenticated 의 테이블 전체 SELECT 를 회수하고, email 을 제외한 컬럼만 다시 부여.
--   클라이언트는 email 을 전혀 SELECT 하지 않으므로(로그인 이메일은 auth.users 사용,
--   public.users.email 은 handle_new_user 가 넣기만 하는 사본) 읽기 동작 불변.
--   서비스롤·SECURITY DEFINER 함수·회원가입 트리거는 컬럼 권한과 무관하게 그대로 동작.
--
--   컬럼(2026-08-23 기준): id, email, nickname, avatar_path, role, gender, age_range,
--     nickname_changed_at, created_at, updated_at
--   → email 만 빼고 부여.
--
--   ※ gender/age_range 도 타인 조회 가능(USING true)하나 클라가 실제로 읽어 쓰는
--     경로(운영자 리포트 등)가 있어 이번엔 유지. 추후 집계/동의 기반으로 좁히는 건 별도 과제.
--
-- 하위호환: 클라 read 경로 불변(email 미사용). anon 은 RLS 정책(TO authenticated)상
--   애초에 행 접근 불가 → 무영향.
-- 복구:
--   GRANT SELECT ON public.users TO authenticated;   -- (email 포함 원복)
-- ============================================================

REVOKE SELECT ON public.users FROM authenticated;

GRANT SELECT (
  id, nickname, avatar_path, role, gender, age_range,
  nickname_changed_at, created_at, updated_at
) ON public.users TO authenticated;
