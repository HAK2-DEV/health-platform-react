-- ============================================================
-- Rollback: 060 - 랭킹 부가 표시 옵션 제거
-- ============================================================

ALTER TABLE public.programs
  DROP COLUMN IF EXISTS trend_enabled,
  DROP COLUMN IF EXISTS period_filter_enabled;
