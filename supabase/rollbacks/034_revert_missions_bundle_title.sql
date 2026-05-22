-- ============================================================
-- ROLLBACK: 034 - missions.bundle_title 컬럼 제거
-- 작성일: 2026-05-22
-- 짝: supabase/migrations/20260522_034_missions_bundle_title.sql
--
-- ⚠️ 수동 실행 전용. 이미 라이브러리에서 추가된 미션의 bundle_title 데이터는 손실됨.
-- ============================================================

ALTER TABLE public.missions DROP COLUMN IF EXISTS bundle_title;
