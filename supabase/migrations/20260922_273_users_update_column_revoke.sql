-- ============================================================
-- Migration: 273 - users 쓰기 권한을 «사용자가 실제로 바꾸는 컬럼» 으로 좁힘
-- 작성일: 2026-09-22
-- 설명:
--   현재 authenticated 는 public.users 에 «전 컬럼 UPDATE» 권한을 갖는다
--   (role·email·created_at 포함). 행 단위는 RLS 정책이 본인 행으로 막고,
--   role 승격은 정책의 WITH CHECK 서브쿼리 하나가 막고 있다 — 얇다.
--   권한 자체를 좁혀 이중으로 만든다.
--
--   클라이언트가 실제로 쓰는 컬럼(코드 전수 확인):
--     nickname · nickname_changed_at · avatar_path · gender · age_range
--     agreed_health_at · home_banner_path
--   role 을 바꾸는 코드 경로는 없다(관리자 승격도 코드에 없음 — 대시보드/SQL 로 한다).
--   email 은 handle_new_user 가 넣기만 하는 사본이고 240 에서 SELECT 도 이미 차단됐다.
--
--   ⚠️ 컬럼 단위 권한은 «전 컬럼 UPDATE» 가 남아 있으면 의미가 없다 →
--      테이블 단위 UPDATE 를 회수하고 필요한 컬럼만 다시 부여한다(240 이 SELECT 에 쓴 방식과 동일).
--
-- 영향:
--   권한만 바꾼다(정책·본문 불변). 위 7개 컬럼 수정은 그대로 동작하고,
--   role·email·created_at·id 를 «고르는» UPDATE 는 42501 로 거부된다.
--   서비스롤(엣지 함수·트리거·DEFINER 함수)은 영향 없음.
--
-- 복구: supabase/rollbacks/273_revert_users_update_column_revoke.sql
-- ============================================================

REVOKE UPDATE ON public.users FROM authenticated, anon;

GRANT UPDATE (
  nickname,
  nickname_changed_at,
  avatar_path,
  gender,
  age_range,
  agreed_health_at,
  home_banner_path
) ON public.users TO authenticated;

-- 확인용:
--   SELECT privilege_type, string_agg(column_name, ', ' ORDER BY column_name)
--   FROM information_schema.column_privileges
--   WHERE table_schema='public' AND table_name='users' AND grantee='authenticated'
--   GROUP BY 1;
--   → UPDATE 행에 위 7개만 있어야 한다.
