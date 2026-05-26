-- ============================================================
-- Rollback: 054 - 053 시점으로 복원 (주의: 재귀 다시 발생 — 실제로는 053도 같이 롤백하는 게 안전)
-- ============================================================

DROP POLICY IF EXISTS "view programs by owner public or participation" ON public.programs;

CREATE POLICY "view programs by owner public or participation"
ON public.programs
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR (status = 'PUBLISHED' AND is_public = true)
  OR EXISTS (
    SELECT 1 FROM public.program_participants pp
    WHERE pp.program_id = programs.id
      AND pp.user_id = auth.uid()
      AND pp.status = 'ACTIVE'
  )
);

DROP FUNCTION IF EXISTS public._is_active_participant(UUID, UUID);
