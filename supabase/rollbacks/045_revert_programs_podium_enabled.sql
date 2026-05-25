-- ============================================================
-- Rollback: 045 - programs.podium_enabled 컬럼 제거
-- 작성일: 2026-05-25
-- 설명: 045 되돌림. 컬럼 자체 삭제 — 기존 행의 값은 같이 사라짐.
-- ============================================================

ALTER TABLE public.programs DROP COLUMN IF EXISTS podium_enabled;
