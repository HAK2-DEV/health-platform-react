-- ============================================================
-- Migration: 009 - programs 의 일정 정책 컬럼 추가
-- 작성일: 2026-05-20
-- 설명: 마법사 1단계의 운영 세부 설정 컬럼들
--
-- schedule_mode TEXT - 운영 요일 모드
--   'ALL_DAYS'  - 매일 운영
--   'WEEKDAYS'  - 평일만 (월-금)
--   'WEEKENDS'  - 주말만 (토-일)
--   'CUSTOM'    - 직접 선택 (active_days 사용)
--
-- active_days INT[] - 운영 요일 (CUSTOM 모드 시)
--   1=월, 2=화, 3=수, 4=목, 5=금, 6=토, 7=일
--
-- excluded_periods JSONB - 제외 기간 배열
--   [{ "start_date": "2026-08-01", "end_date": "2026-08-15", "reason": "휴가" }]
--
-- 본인의 미래 진화: ExcludedPeriod 별도 테이블로 분리 가능.
-- 다만 MVP 1차는 JSONB 로 단순화 (점진적 진화).
-- ============================================================

ALTER TABLE public.programs
ADD COLUMN schedule_mode TEXT NOT NULL DEFAULT 'ALL_DAYS' 
  CHECK (schedule_mode IN ('ALL_DAYS', 'WEEKDAYS', 'WEEKENDS', 'CUSTOM'));

ALTER TABLE public.programs
ADD COLUMN active_days INT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.programs
ADD COLUMN excluded_periods JSONB NOT NULL DEFAULT '[]'::jsonb;