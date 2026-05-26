-- Rollback 061
ALTER TABLE public.programs
  DROP COLUMN IF EXISTS cover_image_path;
