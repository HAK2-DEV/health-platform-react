-- ============================================================
-- Migration: 140 - 금연 「내 변화」 탭 사용 토글
-- 작성일: 2026-06-28
-- 설명:
--   programs.change_tab_enabled (BOOLEAN, 기본 false) 추가.
--   금연 테마에서 「내 변화」(참가자) / 「참가자 추세」(운영자) 탭을 운영자가 켜고 끔.
--   기본 false(옵트인) — 운영자가 켜야 노출.
--
-- 영향: programs 테이블(컬럼 1개 추가). 기존 동작 불변.
--
-- 복구:
--   ALTER TABLE public.programs DROP COLUMN IF EXISTS change_tab_enabled;
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS change_tab_enabled BOOLEAN NOT NULL DEFAULT false;
