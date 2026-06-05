-- ============================================================
-- Migration: 075 - missions.icon_path 컬럼 추가 (미션 라이브러리 자동 아이콘)
-- 작성일: 2026-06-05
-- 설명:
--   운영자가 미션 라이브러리(src/lib/missionLibrary.js) 에서 추가한 미션은
--   사전 제작된 일러스트 아이콘이 자동으로 표시되도록 icon_path 컬럼 추가.
--   값: 'diet/diet_breakfast_photo.png' 같은 public/mission-icons/ 하위 경로.
--   NULL = 운영자가 직접 만든 미션 또는 라이브러리에 아이콘 미정의 → UI 에서
--          카테고리 이모지 fallback.
--
--   존재 가능 값은 클라이언트가 관리 (정적 자산 경로). DB 제약 없음.
--
-- 복구:
--   supabase/rollbacks/075_revert_mission_icon_path.sql 수동 실행 → 컬럼 DROP.
-- ============================================================

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS icon_path TEXT NULL;

COMMENT ON COLUMN public.missions.icon_path IS
  '미션 라이브러리 사전 제작 아이콘 상대 경로 (예: diet/diet_breakfast_photo.png). NULL 이면 카테고리 이모지 fallback.';
