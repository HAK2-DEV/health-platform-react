-- ============================================================
-- Migration: 007 - programs RLS 정책
-- 작성일: 2026-05-19
-- 설명: public.programs 의 RLS 정책 4개
--
-- 정책 1: SELECT
--   - DRAFT 프로그램 → owner 만 봄
--   - PUBLISHED + 'PUBLIC_SEARCH' 포함 → 모든 인증된 사용자
--   - PUBLISHED + 'PUBLIC_SEARCH' 없음 → owner 만 봄
--   (미래에 program_participants 테이블 만들 때 참여자도 SELECT 가능하게 진화)
--
-- 정책 2: INSERT
--   - 인증된 사용자가 본인을 owner 로 INSERT 가능
--
-- 정책 3: UPDATE
--   - owner 만 수정 가능 (마법사 진행 + 미래 진화)
--
-- 정책 4: DELETE
--   - owner 만 삭제 가능
--
-- 정책 5: ADMIN
--   - 모든 작업 가능 (is_admin() 함수 재사용)
-- ============================================================

-- 정책 1: SELECT
CREATE POLICY "view programs based on status and visibility"
ON public.programs 
FOR SELECT
TO authenticated
USING (
  -- 본인이 owner
  owner_id = auth.uid()
  OR
  -- 또는 PUBLISHED + PUBLIC_SEARCH 포함
  (status = 'PUBLISHED' AND is_public = true)
);

-- 정책 2: INSERT
CREATE POLICY "users can create own programs"
ON public.programs 
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());


-- 정책 3: UPDATE
CREATE POLICY "owners can update own programs"
ON public.programs 
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());


-- 정책 4: DELETE
CREATE POLICY "owners can delete own programs"
ON public.programs 
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());


-- 정책 5: ADMIN 모든 작업
CREATE POLICY "admins can do anything on programs"
ON public.programs 
FOR ALL
TO authenticated
USING (public.is_admin());