-- ============================================================
-- Migration: 149 - 달리기 테마 히어로 커스텀(운영자 편집)
-- 작성일: 2026-06-30
-- 설명:
--   programs 테이블에 run_hero JSONB 컬럼 추가 (기본 NULL).
--   달리기 테마(RunningHome) 히어로 문구를 운영자가 편집:
--     { title, subtitle, titleSize, titleBold, titleColor, subtitleSize, subtitleColor }
--   NULL 이면 코드에서 기본 히어로(2색 디자인) 표시(하위호환).
--   읽기는 컬럼 없어도 동작하던 코드라 additive·backward-compatible.
--
-- 복구:
--   ALTER TABLE programs DROP COLUMN IF EXISTS run_hero;
-- ============================================================

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS run_hero JSONB;

COMMENT ON COLUMN programs.run_hero IS '달리기 테마 히어로 커스텀(JSONB): title/subtitle/titleSize/titleBold/titleColor/subtitleSize/subtitleColor. NULL=기본 디자인';
