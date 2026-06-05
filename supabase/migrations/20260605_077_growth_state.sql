-- ============================================================
-- Migration: 077 - 게이미피케이션 성장 상태 (정원/별자리)
-- 작성일: 2026-06-05
-- 설명:
--   참여자별 게이미피케이션 상태 저장. 076 의 gamification_type 이
--   GARDEN 또는 CONSTELLATION 인 프로그램에서 사용.
--
--   growth_state JSONB 구조 (예시):
--   {
--     "garden": {
--       "plants": [
--         {
--           "id": "<uuid>",
--           "position": [row, col],
--           "flower_type": "lavender",
--           "planted_at": "2026-06-05T...",
--           "water_count": 5,
--           "sun_count": 3,
--           "stage": 2,
--           "revealed": false
--         }
--       ],
--       "collection": ["daisy", "lavender"]
--     },
--     "constellation": {
--       "type": "orion",
--       "stars_lit": 3
--     }
--   }
--
--   programs.gamification_type 에 따라 garden 또는 constellation 필드만 채움.
--   RANKING 트랙은 사용 X (NULL 유지).
--
--   기존 RLS: program_participants 의 RLS 가 이미 user_id = auth.uid() 제약.
--   본인 정원만 보임 — 본인 정원 비전 「혼자도 좋고」 자동 충족.
--
-- 복구:
--   supabase/rollbacks/077_revert_growth_state.sql 수동 실행.
-- ============================================================

ALTER TABLE public.program_participants
  ADD COLUMN IF NOT EXISTS growth_state JSONB DEFAULT NULL;

COMMENT ON COLUMN public.program_participants.growth_state IS
  '게이미피케이션 성장 상태 (Day 65). gamification_type=GARDEN/CONSTELLATION 인 프로그램에서만 사용. JSONB 구조는 077 마이그레이션 헤더 참조.';
