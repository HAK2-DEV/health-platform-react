-- ============================================================
-- Migration: 031 - 자동 생성 미션 트리거 폐기
-- 작성일: 2026-05-22
-- 설명: 본인의 (가) 진화에 따른 정리.
--   마법사가 4단계로 단순화되어 features/scoring 단계가 폐기됨
--   (Day 49 — ProgramNewPage.jsx, WizardLayout.jsx 주석 참고).
--   프론트는 이미 정리됐지만 DB 트리거가 살아있어,
--   programs.features 가 채워진 상태로 발행되면 자동 missions INSERT 가 동작.
--
-- 이 마이그레이션의 효과:
--   - 새 프로그램 발행 시 자동 missions INSERT 가 더 이상 일어나지 않음
--   - 운영자는 ProgramDetailPage 의 "미션 추가" 버튼으로 직접 만든다
--
-- 보존되는 것 (의도):
--   - programs.features / programs.score_rules 컬럼은 유지 (데이터 손실 방지)
--   - 기존에 자동 생성된 missions 행은 그대로 유지 (운영자가 필요 시 삭제)
--
-- 복구:
--   supabase/rollbacks/031_restore_auto_mission_trigger.sql 을 수동 실행하면
--   017 의 함수/트리거가 그대로 복원됨.
-- ============================================================

-- 트리거 먼저 (함수에 의존하므로)
DROP TRIGGER IF EXISTS create_missions_on_program_publish ON public.programs;

-- 트리거 함수
DROP FUNCTION IF EXISTS public.create_missions_on_publish();

-- 공통 로직 함수
DROP FUNCTION IF EXISTS public.apply_missions_from_program(UUID);
