-- ============================================================
-- Rollback: 053 - 초대 코드 RPC 제거 + programs RLS 007 시점으로 복원
-- ============================================================

DROP FUNCTION IF EXISTS public.join_with_invite_code(UUID, TEXT);

DROP POLICY IF EXISTS "view programs by owner public or participation" ON public.programs;

CREATE POLICY "view programs based on status and visibility"
ON public.programs
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR (status = 'PUBLISHED' AND is_public = true)
);
