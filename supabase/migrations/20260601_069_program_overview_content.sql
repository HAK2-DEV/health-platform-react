-- ============================================================
-- 069: programs.overview_content — 운영자 자유 개요 글 (Markdown)
-- ============================================================
-- 작성일: 2026-06-01
-- 설명: 본인 결정 (Day 58) — ProgramDetailPage 「개요」 탭에 운영자가 자유롭게
--       작성하는 긴 글 영역 추가. 마크다운 포맷 지원.
--
-- 기존 description (PROGRAM.DESCRIPTION_MAX_LENGTH) 은 짧은 한 줄 소개로 유지
-- (카드/모달 미리보기용). overview_content 는 긴 글 전용 — 역할 분리.
--
-- 마크다운: react-markdown + remark-gfm 로 렌더링. 굵게/링크/리스트/체크박스 등.
--
-- 기존 행 호환:
--   - overview_content NULL → 기존 프로그램은 빈 상태 (UI 에서 운영자만 빈 영역 + 편집 안내)
--
-- 복구: rollbacks/069_revert_program_overview_content.sql

BEGIN;

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS overview_content TEXT;

COMMENT ON COLUMN public.programs.overview_content IS
  '운영자가 「개요」 탭에 작성하는 자유 글 (Markdown). 짧은 description 과 분리된 긴 글 전용.';

COMMIT;
