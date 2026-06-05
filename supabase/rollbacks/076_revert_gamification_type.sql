-- 076 복구 — gamification_type / streak_preset / streak_milestones DROP.
-- 주의: 운영자가 설정한 트랙 선택 정보 손실.

ALTER TABLE public.programs DROP COLUMN IF EXISTS streak_milestones;
ALTER TABLE public.programs DROP COLUMN IF EXISTS streak_preset;
ALTER TABLE public.programs DROP COLUMN IF EXISTS gamification_type;
