-- ============================================================
-- Migration: 019 - score_ledgers 테이블 + RLS
-- 작성일: 2026-05-20
-- 설명: 점수 발생 내역의 원시 기록. SSRD F-SCORE-020 의 "ScoreLog".
--       누적값을 저장하지 않고 각 점수 발생 사실을 한 행으로 기록.
--       랭킹은 이 테이블의 SUM 또는 ranking_snapshots 캐시로 산출.
--
-- 컬럼:
--   verification_id UNIQUE: 한 인증은 점수 1행만 (중복 부여 방지)
--   reason TEXT: 사람이 읽을 수 있는 사유 ("AUTO 인증 승인", "수동 승인" 등)
--   point INT: 부여 점수 (음수도 가능 — 미래 패널티 대비)
--
-- 점수 INSERT 는 020 의 SECURITY DEFINER 트리거가 담당.
-- 일반 사용자의 직접 INSERT/UPDATE/DELETE 는 정책 없음 = 거부 (RLS 기본 동작).
-- ============================================================

CREATE TABLE public.score_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  verification_id UUID UNIQUE REFERENCES public.verifications(id) ON DELETE CASCADE,
  point INT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스: 본인 랭킹/점수 합산 조회용
CREATE INDEX idx_score_ledgers_program_user ON public.score_ledgers(program_id, user_id);
CREATE INDEX idx_score_ledgers_user ON public.score_ledgers(user_id);

-- RLS 활성화
ALTER TABLE public.score_ledgers ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- RLS 정책
--   SELECT 만 명시. INSERT/UPDATE/DELETE 는 일반 사용자에 정책 없음 = 거부.
--   020 트리거가 SECURITY DEFINER 로 INSERT 우회.
--   ADMIN 은 모든 작업 가능 (감사·교정 목적).
-- ============================================================

-- SELECT: 본인 점수 + 본인 프로그램의 모든 점수 (운영자 통계용)
CREATE POLICY "view own or own program score ledgers"
ON public.score_ledgers
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR
  program_id IN (
    SELECT id FROM public.programs WHERE owner_id = auth.uid()
  )
);

-- ADMIN: 모든 작업
CREATE POLICY "admins can do anything on score ledgers"
ON public.score_ledgers
FOR ALL
TO authenticated
USING (public.is_admin());
