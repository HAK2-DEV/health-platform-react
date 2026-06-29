-- ============================================================
-- Migration: 145 - programs.overview_progress_enabled (나의 진행 현황 카드 표시 토글)
-- 작성일: 2026-06-29
-- 설명:
--   개요의 「나의 진행 현황」 카드를 운영자가 켜고 끌 수 있게.
--   기본값 true(표시) → 기존 프로그램은 그대로 노출(하위호환).
--   138(공지)/139(절약차감)/140(내 변화) 토글과 동일 패턴.
--
-- 영향: programs 컬럼 1개 추가. 코드는 'overview_progress_enabled' in program 가드로
--       적용 전에도 저장/표시 안 깨짐.
--
-- 복구:
--   ALTER TABLE public.programs DROP COLUMN IF EXISTS overview_progress_enabled;
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS overview_progress_enabled BOOLEAN NOT NULL DEFAULT true;
