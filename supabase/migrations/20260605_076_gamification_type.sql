-- ============================================================
-- Migration: 076 - 게이미피케이션 트랙 + 연속 보너스 프리셋
-- 작성일: 2026-06-05
-- 설명:
--   프로그램 마법사에서 운영자가 「랭킹 / 정원 / 별자리」 중 선택.
--   기존 ranking_enabled 와 통합 — 본인 모델 「물(인증)+햇빛(출석)」 메타포.
--
--   gamification_type:
--     RANKING      — 기존 점수 순위 (기본)
--     GARDEN       — 정원 성장형 (씨앗 → 만개)
--     CONSTELLATION — 별자리 성장형 (별 점등 → 별자리 완성)
--
--   streak_preset (성장형일 때 연속 보너스 마일스톤):
--     short  — [3, 7]      단기 프로그램 (~2주)
--     medium — [7, 14]     중간 (2-4주)
--     long   — [7, 14, 30] 장기 (1달+)
--     custom — streak_milestones 컬럼 사용
--
--   streak_milestones INT[]:
--     custom 일 때만 사용. 예: ARRAY[5, 10, 15].
--
-- 기존 ranking_enabled 백필:
--   true  → gamification_type='RANKING'
--   false → gamification_type='RANKING' (그대로. 운영자가 마법사에서 변경)
--   ranking_enabled 컬럼은 deprecated 표시. 후속 제거 가능.
--
-- 복구:
--   supabase/rollbacks/076_revert_gamification_type.sql 수동 실행.
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS gamification_type TEXT NOT NULL DEFAULT 'RANKING'
    CHECK (gamification_type IN ('RANKING', 'GARDEN', 'CONSTELLATION'));

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS streak_preset TEXT NOT NULL DEFAULT 'medium'
    CHECK (streak_preset IN ('short', 'medium', 'long', 'custom'));

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS streak_milestones INT[] DEFAULT NULL;

-- 기존 row 백필: ranking_enabled 컬럼이 있으면 변환
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'ranking_enabled'
  ) THEN
    -- 모두 RANKING 으로 일단 — 운영자가 마법사에서 변경
    UPDATE public.programs
    SET gamification_type = 'RANKING'
    WHERE gamification_type IS NULL OR gamification_type = 'RANKING';
  END IF;
END $$;

COMMENT ON COLUMN public.programs.gamification_type IS
  '게이미피케이션 트랙 (Day 65). RANKING=점수 순위 / GARDEN=정원 / CONSTELLATION=별자리. 마법사에서 운영자 선택.';
COMMENT ON COLUMN public.programs.streak_preset IS
  '연속 보너스 마일스톤 프리셋 (성장형 트랙에서만 사용). short=[3,7], medium=[7,14], long=[7,14,30], custom=streak_milestones 사용.';
COMMENT ON COLUMN public.programs.streak_milestones IS
  'custom 프리셋일 때만 사용. 예: ARRAY[5,10,15] — 운영자 자유 입력.';
