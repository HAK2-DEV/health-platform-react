-- ============================================================
-- Migration: 003 - users RLS 정책
-- 작성일: 2026-05-19
-- 설명: public.users 의 RLS 정책 + ADMIN 점검 함수
--
-- is_admin() 함수: 현재 사용자가 ADMIN 인지 점검 (SECURITY DEFINER).
--   RLS 정책 안에서 직접 SELECT 시 무한 재귀 함정 발생.
--   SECURITY DEFINER 함수로 분리하면 RLS 우회 가능.
--
-- 정책 1: 모든 인증된 사용자가 모든 사용자 정보 SELECT 가능
--   이유: 랭킹/심사 화면에서 다른 사용자 닉네임 표시 필요.
--
-- 정책 2: 본인의 행만 UPDATE 가능 (role 변경 차단)
--   이유: 본인이 본인을 ADMIN 으로 변경 못 하게 보안.
--
-- 정책 3: ADMIN 은 모든 작업 가능
-- ============================================================

-- ADMIN 점검 함수 (RLS 우회용)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
END;
$$;


-- 정책 1: SELECT (모든 인증된 사용자)
CREATE POLICY "authenticated users can view all users"
ON public.users 
FOR SELECT
TO authenticated
USING (true);


-- 정책 2: UPDATE (본인 행 + role 변경 차단)
CREATE POLICY "users can update own profile"
ON public.users 
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid() 
  AND role = (SELECT role FROM public.users WHERE id = auth.uid())
);


-- 정책 3: ADMIN 모든 작업
CREATE POLICY "admins can do anything"
ON public.users 
FOR ALL
TO authenticated
USING (public.is_admin());