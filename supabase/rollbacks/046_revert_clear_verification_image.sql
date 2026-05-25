-- ============================================================
-- Rollback: 046 - clear_my_verification_image 함수 제거
-- ============================================================
DROP FUNCTION IF EXISTS public.clear_my_verification_image(UUID);
