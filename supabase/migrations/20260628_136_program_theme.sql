-- ============================================================
-- Migration: 136 - 프로그램 테마 (상세 페이지 변형용)
-- 작성일: 2026-06-28
-- 설명:
--   programs.theme (TEXT, nullable) 추가.
--   특정 테마('QUIT_SMOKING' 등)면 상세 페이지를 변형 렌더(히어로·탭·미션).
--   NULL = 일반 프로그램(기본 UI). 라이브러리 금연 프리셋이 이 값을 세팅할 예정.
--   하위호환: 기본 NULL — 기존 행/코드 영향 없음.
--
-- 영향: programs 테이블(컬럼 1개 추가). 기존 동작 불변.
--
-- 복구:
--   ALTER TABLE public.programs DROP COLUMN IF EXISTS theme;
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS theme TEXT;
