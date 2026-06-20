-- ============================================================
-- Migration: 091 - 개요 「안내」 섹션 커스텀 제목
-- 작성일: 2026-06-20
-- 설명:
--   개요 탭의 「📝 안내」 섹션 제목을 운영자가 원하는 문구(예: 공지사항,
--   프로그램 소개, 시작 안내 등)로 바꿀 수 있도록 컬럼 추가.
--   NULL → 참여자 화면에서 기본값 '안내' 표시 (하위호환, 기존 프로그램 영향 없음).
--
-- 복구: ALTER TABLE public.programs DROP COLUMN IF EXISTS overview_title;
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS overview_title TEXT;
