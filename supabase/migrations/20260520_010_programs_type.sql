-- ============================================================
-- Migration: 010 - programs 의 program_type 컬럼 추가
-- 작성일: 2026-05-20
-- 설명: 마법사 2단계의 프로그램 유형 선택
--
-- program_type TEXT - 운영자가 선택 (단일 선택)
--   'CERTIFICATION' - 인증형 (사진 인증 중심)
--   'RECORD'        - 기록형 (숫자/데이터 기록 중심)
--   'MISSION'       - 미션형 (정해진 미션 수행)
--   'HABIT'         - 습관형성형 (매일 반복 습관)
--
-- DRAFT 상태는 NULL 허용 (마법사 진행 중).
-- PUBLISHED 시점에 NOT NULL 강제 (애플리케이션 차원에서 검증).
--
-- 미래 진화: AI 추천 (v2.0) - 본인의 의도/목표 입력 → 유형 추천
-- ============================================================

ALTER TABLE public.programs
ADD COLUMN program_type TEXT 
  CHECK (program_type IS NULL OR program_type IN ('CERTIFICATION', 'RECORD', 'MISSION', 'HABIT'));

-- 인덱스 (유형별 빠른 검색)
CREATE INDEX idx_programs_type ON public.programs(program_type);