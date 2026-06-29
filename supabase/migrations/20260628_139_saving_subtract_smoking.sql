-- ============================================================
-- Migration: 139 - 금연 「오늘 절약」 흡연 차감 토글
-- 작성일: 2026-06-28
-- 설명:
--   programs.saving_subtract_smoking (BOOLEAN, 기본 true) 추가.
--   금연 테마 히어로 「오늘 절약」 계산 방식을 운영자가 선택:
--     true  = (아낀 − 흡연)×개비당가 → 핀 만큼 마이너스 표시
--     false = 아낀×개비당가만 → 안 핀 만큼만 절약(마이너스 없음)
--   기본 true → 현재 동작(차감) 유지. 게이팅 코드도 컬럼 없으면 true 로 간주(안전).
--
-- 영향: programs 테이블(컬럼 1개 추가). 기존 동작 불변.
--
-- 복구:
--   ALTER TABLE public.programs DROP COLUMN IF EXISTS saving_subtract_smoking;
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS saving_subtract_smoking BOOLEAN NOT NULL DEFAULT true;
