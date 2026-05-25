-- ============================================================
-- Rollback: 047 - clear_my_verification_image 권한을 046 시점으로 복원
-- ============================================================

CREATE OR REPLACE FUNCTION public.clear_my_verification_image(p_verification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
  v_authorized BOOLEAN;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.verifications v
    JOIN public.missions m ON m.id = v.mission_id
    JOIN public.programs p ON p.id = m.program_id
    WHERE v.id = p_verification_id
      AND (v.user_id = v_caller OR p.owner_id = v_caller)
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RETURN false;
  END IF;

  UPDATE public.verifications
  SET image_path = NULL
  WHERE id = p_verification_id;

  RETURN FOUND;
END;
$$;
