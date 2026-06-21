-- ============================================================
-- Migration: 102 - 프로그램 메뉴바 토글 (퀴즈/커뮤니티 사용 여부)
-- 작성일: 2026-06-21
-- 설명:
--   운영자가 「프로그램 설정」에서 퀴즈·커뮤니티 메뉴 사용 여부를 끌 수 있음.
--   OFF 면 참여자 탭바 + 운영자 「메뉴바 설정」에서 해당 항목 숨김.
--   기본 true (기존 프로그램은 모두 사용 상태) → 하위호환.
--
-- 복구: ALTER TABLE programs DROP COLUMN quiz_enabled, DROP COLUMN community_enabled;
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS quiz_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS community_enabled BOOLEAN NOT NULL DEFAULT true;
