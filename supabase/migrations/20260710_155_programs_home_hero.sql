-- ============================================================
-- Migration: 155 - programs.home_hero (카드홈 편집형 히어로)
-- 작성일: 2026-07-10
-- 설명:
--   카드형 홈 표지 히어로를 달리기처럼 "편집 가능한" 히어로로.
--   home_hero JSONB = { titleHtml, subtitleHtml, useImage(bool), gradient(0~100) }
--   운영자가 제목·부제 리치 편집(크기·색·볼드) + 배경 사진(표지 재활용) on/off + 그라데이션 조절.
--   NULL(기본) = 프로그램명 기반 기본 텍스트, 사진 없음.
--
-- 영향: nullable JSONB 컬럼 1개 추가. 기존 행 NULL → 기본(동작 불변).
--
-- 복구:
--   ALTER TABLE public.programs DROP COLUMN IF EXISTS home_hero;
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS home_hero JSONB;
