-- ============================================================
-- Rollback: 052 - get_pending_reviews 시그니처 030 시점으로 복원
-- ============================================================

DROP FUNCTION IF EXISTS public.get_pending_reviews(UUID);

CREATE OR REPLACE FUNCTION public.get_pending_reviews(p_program_id UUID)
RETURNS TABLE (
  v_id            UUID,
  v_image_path    TEXT,
  v_numeric_value NUMERIC,
  v_note          TEXT,
  v_submitted_at  TIMESTAMPTZ,
  m_id            UUID,
  m_title         TEXT,
  m_point         INT,
  u_id            UUID,
  u_nickname      TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id, v.image_path, v.numeric_value, v.note, v.submitted_at,
    m.id, m.title, m.point,
    u.id, u.nickname
  FROM public.verifications v
  JOIN public.missions m ON m.id = v.mission_id
  JOIN public.users u ON u.id = v.user_id
  WHERE m.program_id = p_program_id
    AND v.status = 'PENDING_REVIEW'
    AND m.program_id IN (
      SELECT id FROM public.programs WHERE owner_id = auth.uid()
    )
  ORDER BY v.submitted_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_reviews(UUID) TO authenticated;
