-- ============================================================
-- 069 복구: programs.overview_content 컬럼 제거
-- ============================================================
-- ⚠️ DROP COLUMN 은 데이터 손실 — 모든 프로그램의 개요 글이 사라짐.
--   복구 전 본인이 데이터 백업 또는 보존 여부 확인 필요.

BEGIN;

ALTER TABLE public.programs
  DROP COLUMN IF EXISTS overview_content;

COMMIT;
