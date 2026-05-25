-- ============================================================
-- Migration: 045 - programs.podium_enabled 컬럼 추가
-- 작성일: 2026-05-25
-- 설명: 본인 결정 — 랭킹 페이지의 Top 3 포디움(시상대 시각화)을 프로그램별 옵션으로.
--   기본 false → 기존 평면 랭킹 그대로
--   true 켜면 → 랭킹 페이지 상단에 2-1-3 포디움 카드 노출
--
-- UI:
--   마법사 Step2Type 토글 + ProgramEditModal 토글 (feed_enabled 와 같은 패턴)
--   RankingsPage 가 selectedProgram.podium_enabled 로 조건부 렌더
--
-- 복구:
--   supabase/rollbacks/045_revert_programs_podium_enabled.sql 수동 실행.
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS podium_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.programs.podium_enabled IS
  '랭킹 페이지에 Top 3 시상대(포디움) 시각화를 표시할지 여부. 기본 false.';
