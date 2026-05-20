-- ============================================================
-- Migration: 008 - programs 의 categories 컬럼 추가
-- 작성일: 2026-05-20
-- 설명: 프로그램의 카테고리 (복수 선택)
--
-- categories TEXT[] - 운영자가 선택 (복수 선택 가능)
--   'WALKING'   - 걷기
--   'DIET'      - 식단
--   'EMPATHY'   - 공감
--   'MINDCARE'  - 마음관리
--   'SLEEP'     - 수면
--   'NO_SMOKING'- 금연
--
-- 본인이 미래에 카테고리 추가 시 CHECK 제약 없이 진화 가능.
-- 클라이언트 측 검증으로 허용 카테고리 강제.
-- ============================================================

ALTER TABLE public.programs
ADD COLUMN categories TEXT[] NOT NULL DEFAULT '{}';

-- 인덱스 (카테고리별 빠른 검색)
CREATE INDEX idx_programs_categories ON public.programs USING GIN (categories);