-- ============================================================
-- Migration: 012 - programs 의 점수 규칙 컬럼 추가
-- 작성일: 2026-05-20
-- 설명: 마법사 4단계의 점수 규칙 설정 (MVP 1차)
--
-- score_rules JSONB - 활동별 점수 규칙
--   {
--     "image_upload": { "score": 10, "daily_limit": 3 },
--     "comment":      { "score": 1, "daily_limit": 10 },
--     "like":         { "score": 1, "daily_limit": 20 },
--     "numeric_record": { "score": 5, "daily_limit": 1 },
--     "body_metrics": { "score": 5, "daily_limit": 1 },
--     "quiz":         { "score": 10, "daily_limit": null }
--   }
--   - score: 활동당 점수
--   - daily_limit: 하루 최대 인정 횟수 (null = 무제한)
--
-- daily_max_score INT - 하루 최대 점수 (전체 합계, null = 무제한)
--
-- approval_mode TEXT - 승인 방식
--   'AUTO'   - 자동 승인 (제출 즉시 점수)
--   'MANUAL' - 수동 승인 (운영자 심사 후 점수)
--
-- 본인의 미래 진화 (MVP 2차):
--   - 연속 참여 보너스 (streak_bonus)
--   - 점수 시뮬레이션
--   - 일정 정책 (schedule_policy)
-- ============================================================

ALTER TABLE public.programs
ADD COLUMN score_rules JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.programs
ADD COLUMN daily_max_score INT;

ALTER TABLE public.programs
ADD COLUMN approval_mode TEXT NOT NULL DEFAULT 'AUTO'
  CHECK (approval_mode IN ('AUTO', 'MANUAL'));