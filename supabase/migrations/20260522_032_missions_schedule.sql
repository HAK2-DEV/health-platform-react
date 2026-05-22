-- ============================================================
-- Migration: 032 - missions 에 일정 정책 컬럼 추가 (프로그램 단위 → 미션 단위)
-- 작성일: 2026-05-22
-- 설명: 본인의 결정 — 운영 요일/제외 기간을 미션 단위로 옮김.
--   마법사 (가) 진화에서 자동 생성 미션을 폐기하고 운영자가 직접 미션을 추가하는
--   흐름이 메인이 됨. 그에 맞춰 일정도 미션 단위로 두는게 일관적.
--
-- 추가 컬럼 (009 의 programs 컬럼과 동일 시맨틱):
--   schedule_mode TEXT      'ALL_DAYS' | 'WEEKDAYS' | 'WEEKENDS' | 'CUSTOM'
--   active_days   INT[]     CUSTOM 모드 시 운영 요일 (1=월 ... 7=일)
--   excluded_periods JSONB  [{ "start_date": "...", "end_date": "...", "reason": "..." }]
--
-- 보존 (의도):
--   programs 의 동일 컬럼들은 그대로 유지 — 기존 데이터 손실 방지 + 향후 정책 결정 여지.
--   본 마이그레이션은 missions 에 디폴트 값으로 추가만 (점수 트리거 변경은 033 에서).
--
-- 디폴트:
--   schedule_mode = 'ALL_DAYS' (매일 운영) — 기존 미션은 자동으로 매일 운영으로 잡힘
--     (지금까지의 동작과 동일하므로 회귀 없음)
--
-- 복구:
--   supabase/rollbacks/032_revert_missions_schedule.sql 수동 실행으로 컬럼 제거.
-- ============================================================

ALTER TABLE public.missions
ADD COLUMN schedule_mode TEXT NOT NULL DEFAULT 'ALL_DAYS'
  CHECK (schedule_mode IN ('ALL_DAYS', 'WEEKDAYS', 'WEEKENDS', 'CUSTOM'));

ALTER TABLE public.missions
ADD COLUMN active_days INT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.missions
ADD COLUMN excluded_periods JSONB NOT NULL DEFAULT '[]'::jsonb;
