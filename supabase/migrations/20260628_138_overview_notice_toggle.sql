-- ============================================================
-- Migration: 138 - 개요 공지사항(안내) 사용 토글
-- 작성일: 2026-06-28
-- 설명:
--   programs.overview_notice_enabled (BOOLEAN, 기본 true) 추가.
--   개요 상단 「📢 공지사항(안내, overview_content)」 카드를 운영자가 끌 수 있게.
--   필요한 운영자만 쓰도록 — OFF 면 개요에 공지 카드 미노출.
--   기본 true → 기존 프로그램은 동작 그대로(하위호환). 게이팅 코드도 컬럼 없으면 노출로 간주(안전).
--
-- 영향: programs 테이블(컬럼 1개 추가). 기존 동작 불변.
--
-- 복구:
--   ALTER TABLE public.programs DROP COLUMN IF EXISTS overview_notice_enabled;
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS overview_notice_enabled BOOLEAN NOT NULL DEFAULT true;
