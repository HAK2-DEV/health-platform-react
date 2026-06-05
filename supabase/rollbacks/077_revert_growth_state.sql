-- 077 복구 — program_participants.growth_state DROP.
-- 주의: 운영 중 사용자의 정원·별자리 데이터 전체 손실.

ALTER TABLE public.program_participants
  DROP COLUMN IF EXISTS growth_state;
