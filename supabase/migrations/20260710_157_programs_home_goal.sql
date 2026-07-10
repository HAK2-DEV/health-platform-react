-- ============================================================
-- Migration: 157 - programs.home_goal (카드홈 요약 지표 좌측 카드 편집)
-- 작성일: 2026-07-10
-- 설명:
--   카드형 홈 「요약 지표」 좌측 카드(추천 페이스/목표 걸음 등)를 운영자가 직접 편집.
--   home_goal JSONB = { title, value, unit, hint }  (제목·내용·단위·힌트)
--   NULL(기본) = 카테고리 기본값(CATEGORY_GOAL) + 달리기는 run_pace.
--
-- 영향: nullable JSONB 컬럼 1개 추가. 기존 행 NULL → 기본(동작 불변).
--
-- 복구:
--   ALTER TABLE public.programs DROP COLUMN IF EXISTS home_goal;
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS home_goal JSONB;
