-- ============================================================
-- Migration: 015 - program_participants RLS 정책
-- 작성일: 2026-05-20
-- 설명: 참여 정보 접근 제어
--
-- SELECT: 본인의 참여 기록 OR 본인이 운영하는 프로그램의 참여자
-- INSERT: 본인을 참여자로 등록 (user_id = auth.uid())
-- UPDATE: 프로그램 운영자 (승인/거절) OR 본인 (완료 등)
-- DELETE: 본인 (참여 취소) OR 운영자
-- ADMIN: 모든 작업
-- ============================================================

-- SELECT: 본인 참여 기록 OR 본인 프로그램의 참여자
CREATE POLICY "view own participation or own program participants"
ON public.program_participants 
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR
  program_id IN (
    SELECT id FROM public.programs WHERE owner_id = auth.uid()
  )
);

-- INSERT: 본인을 참여자로
CREATE POLICY "users can join programs"
ON public.program_participants 
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: 운영자 (승인/거절) OR 본인
CREATE POLICY "owners and self can update participation"
ON public.program_participants 
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR
  program_id IN (
    SELECT id FROM public.programs WHERE owner_id = auth.uid()
  )
);

-- DELETE: 본인 (참여 취소) OR 운영자
CREATE POLICY "self and owners can delete participation"
ON public.program_participants 
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR
  program_id IN (
    SELECT id FROM public.programs WHERE owner_id = auth.uid()
  )
);

-- ADMIN: 모든 작업
CREATE POLICY "admins can do anything on participants"
ON public.program_participants 
FOR ALL
TO authenticated
USING (public.is_admin());