-- ============================================================
-- Rollback: 056 - missions SELECT 정책 016 시점으로 복원
-- ============================================================

DROP POLICY IF EXISTS "view missions of accessible programs" ON public.missions;

CREATE POLICY "view missions of accessible programs"
ON public.missions
FOR SELECT
TO authenticated
USING (
  program_id IN (
    SELECT id FROM public.programs
    WHERE owner_id = auth.uid()
       OR (status = 'PUBLISHED' AND is_public = true)
  )
);
