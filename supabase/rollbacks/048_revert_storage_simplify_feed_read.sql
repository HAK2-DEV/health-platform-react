-- ============================================================
-- Rollback: 048 - 피드 storage SELECT 정책을 038 시점으로 복원
-- ============================================================

DROP POLICY IF EXISTS "verification images: linked verification visible" ON storage.objects;

CREATE POLICY "verification images: feed peers can read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-images'
  AND EXISTS (
    SELECT 1 FROM public.verifications v
    JOIN public.missions m ON m.id = v.mission_id
    JOIN public.programs p ON p.id = m.program_id
    JOIN public.program_participants pp ON pp.program_id = p.id
    WHERE v.image_path = name
      AND v.status = 'APPROVED'
      AND p.feed_enabled = true
      AND pp.user_id = auth.uid()
      AND pp.status = 'ACTIVE'
  )
);
