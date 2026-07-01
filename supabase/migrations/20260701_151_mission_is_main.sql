-- ============================================================
-- Migration: 151 - 미션 메인/서브 구분 (달리기 주간 스트릭 색 구분)
-- 작성일: 2026-07-01
-- 설명:
--   missions 에 is_main BOOLEAN 추가 (기본 TRUE = 메인).
--   달리기 테마 주간 스트릭에서 메인 미션 요일은 초록, 서브(is_main=false) 요일은 앰버 도장.
--   기본 TRUE 라 기존 미션은 모두 메인 → 현행 동작(전부 초록) 유지(하위호환).
--   읽기는 컬럼 없어도 코드가 is_main !== false 로 메인 취급 → additive·backward-compatible.
--
-- 복구:
--   ALTER TABLE missions DROP COLUMN IF EXISTS is_main;
-- ============================================================

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS is_main BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN missions.is_main IS '메인 미션 여부(달리기 주간 스트릭 색 구분). true=메인(초록), false=서브(앰버). 기본 true';
