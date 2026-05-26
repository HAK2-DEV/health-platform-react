-- ============================================================
-- Rollback: 057 - verifications INSERT 정책을 018 시점으로 복원
-- ============================================================

DROP POLICY IF EXISTS "users can submit verification" ON public.verifications;

CREATE POLICY "users can submit verification"
ON public.verifications
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND
  mission_id IN (
    SELECT m.id
    FROM public.missions m
    JOIN public.program_participants pp ON pp.program_id = m.program_id
    WHERE pp.user_id = auth.uid() AND pp.status = 'ACTIVE'
  )
);
