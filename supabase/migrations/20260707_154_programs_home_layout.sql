-- ============================================================
-- Migration: 154 - programs.home_layout (운영자 카드홈 레이아웃 편집)
-- 작성일: 2026-07-07
-- 설명:
--   카드형 홈(card_home, 마이그 153)에서 운영자가 박스 순서·숨김을 편집할 수 있게 저장.
--   home_layout JSONB = { "order": [박스키...], "hidden": [박스키...] }
--   NULL(기본) = 코드의 기본 순서/전부 표시. 박스 크기는 코드에서 고정(운영자 변경 불가, Rule 1).
--   고정 박스(표지 히어로·메뉴 카드)는 order/hidden 대상 아님(코드에서 항상 렌더).
--
-- 영향: nullable JSONB 컬럼 1개 추가. 기존 행 NULL → 기본 레이아웃(동작 불변).
--
-- 복구:
--   ALTER TABLE public.programs DROP COLUMN IF EXISTS home_layout;
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS home_layout JSONB;
