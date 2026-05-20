-- ============================================================
-- Migration: 014 - program_participants 테이블 생성
-- 작성일: 2026-05-20
-- 설명: 프로그램 참여 정보
--
-- status:
--   'PENDING'   - 승인 대기 (APPROVAL 방식)
--   'ACTIVE'    - 참여 중
--   'REJECTED'  - 거절됨
--   'COMPLETED' - 완료
--
-- 본인의 join_type 연동:
--   FREE        → 바로 ACTIVE
--   APPROVAL    → PENDING → (운영자 승인) → ACTIVE
--   INVITE_CODE → 코드 확인 → ACTIVE
--
-- UNIQUE(program_id, user_id): 한 프로그램에 한 번만 참여
-- ============================================================

CREATE TABLE public.program_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' 
    CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'COMPLETED')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  UNIQUE (program_id, user_id)
);

-- 인덱스
CREATE INDEX idx_participants_program ON public.program_participants(program_id);
CREATE INDEX idx_participants_user ON public.program_participants(user_id);

-- RLS 활성화
ALTER TABLE public.program_participants ENABLE ROW LEVEL SECURITY;
