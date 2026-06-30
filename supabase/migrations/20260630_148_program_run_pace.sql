-- ============================================================
-- Migration: 148 - 달리기 테마 운영자 추천 페이스
-- 작성일: 2026-06-30
-- 설명:
--   programs 테이블에 run_pace TEXT 컬럼 추가 (기본 NULL).
--   달리기 테마(RunningHome) 「추천 페이스」를 운영자가 자유 텍스트로 설정
--   (예: "6'20"). NULL 이면 코드에서 기본값 "6'20" 으로 표시(하위호환).
--   읽기는 컬럼 없어도 동작하던 코드라 additive·backward-compatible.
--
-- 복구:
--   ALTER TABLE programs DROP COLUMN IF EXISTS run_pace;
-- ============================================================

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS run_pace TEXT;

COMMENT ON COLUMN programs.run_pace IS '달리기 테마 추천 페이스(자유 텍스트, 예: 6''20). NULL=기본값 표시';
