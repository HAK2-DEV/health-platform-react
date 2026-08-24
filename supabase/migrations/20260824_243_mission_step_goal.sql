-- ============================================================
-- Migration: 243 - 걸음 자동 인증 미션 (step_goal)
-- 작성일: 2026-08-24
-- 설명:
--   네이티브(Android=Health Connect, iOS=HealthKit) 걸음 데이터로 자동 인증하는
--   미션 유형 추가. verify_style='steps' + step_goal(목표 걸음).
--   참여자가 오늘 걸음이 step_goal 이상이면 사진·수동 없이 자동 인증(verification_type=AUTO).
--
--   기존 verify_style(meditation/meal/null)과 동일 패턴. step_goal 은 nullable 추가라 하위호환.
--   (걸음 미션이 아니면 NULL)
--
-- 복구: ALTER TABLE public.missions DROP COLUMN IF EXISTS step_goal;
-- ============================================================

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS step_goal INT;
