-- ============================================================
-- Migration: 016 - missions 테이블 생성
-- 작성일: 2026-05-20
-- 설명: 프로그램 내 활동 단위(미션). 본인의 features+score_rules 마법사가
--       PUBLISHED될 때 자동 INSERT 되는 행(017 트리거에서 처리).
--
-- 컬럼:
--   feature: image_upload / numeric_record / comment / like / quiz / body_metrics
--     → 어느 기능 모듈에서 자동 생성되었는지 추적
--   title: 자동 생성 라벨 (예: "사진 인증", "기록 입력")
--   instruction: 운영자 추가 설명 (선택)
--   verification_type: AUTO(즉시 승인) / MANUAL(운영자 심사)
--     → programs.approval_mode 를 따라옴
--   point: 1회 인증 시 부여 점수
--     → programs.score_rules[feature].score 를 따라옴
--   daily_limit: 하루 최대 인증 횟수 (NULL = 무제한)
--     → programs.score_rules[feature].daily_limit 를 따라옴
--   active_from / active_until: 미션 활성 기간
--     → 기본은 programs.start_date / end_date 따라옴
--
-- UNIQUE(program_id, feature):
--   한 프로그램의 한 기능 모듈은 하나의 미션으로만 자동 생성 (중복 방지)
-- ============================================================

CREATE TABLE public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  feature TEXT NOT NULL
    CHECK (feature IN ('image_upload', 'numeric_record', 'comment', 'like', 'quiz', 'body_metrics')),
  title TEXT NOT NULL,
  instruction TEXT,
  verification_type TEXT NOT NULL
    CHECK (verification_type IN ('AUTO', 'MANUAL')),
  point INT NOT NULL DEFAULT 0,
  daily_limit INT NULL,
  active_from TIMESTAMPTZ,
  active_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (program_id, feature)
);

-- 인덱스 (참여자가 프로그램의 미션 목록을 자주 조회)
CREATE INDEX idx_missions_program ON public.missions(program_id);

-- RLS 활성화
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS 정책
-- ============================================================

-- SELECT: 다음 셋 중 하나면 미션 조회 가능
--   1) 본인이 운영자
--   2) 프로그램이 PUBLISHED + is_public (공개 둘러보기 진입)
--   3) 본인이 ACTIVE 참여 중 (비공개 프로그램의 참여자 케이스 대비)
CREATE POLICY "view missions of accessible programs"
ON public.missions
FOR SELECT
TO authenticated
USING (
  program_id IN (
    SELECT id FROM public.programs
    WHERE owner_id = auth.uid()
       OR (status = 'PUBLISHED' AND is_public = true)
  )
  OR
  program_id IN (
    SELECT program_id FROM public.program_participants
    WHERE user_id = auth.uid() AND status = 'ACTIVE'
  )
);

-- INSERT: 운영자만 (017 트리거도 SECURITY DEFINER로 우회 — 트리거 만들 때 처리)
CREATE POLICY "owners can insert missions"
ON public.missions
FOR INSERT
TO authenticated
WITH CHECK (
  program_id IN (
    SELECT id FROM public.programs WHERE owner_id = auth.uid()
  )
);

-- UPDATE: 운영자만
CREATE POLICY "owners can update missions"
ON public.missions
FOR UPDATE
TO authenticated
USING (
  program_id IN (
    SELECT id FROM public.programs WHERE owner_id = auth.uid()
  )
);

-- DELETE: 운영자만
CREATE POLICY "owners can delete missions"
ON public.missions
FOR DELETE
TO authenticated
USING (
  program_id IN (
    SELECT id FROM public.programs WHERE owner_id = auth.uid()
  )
);

-- ADMIN: 모든 작업
CREATE POLICY "admins can do anything on missions"
ON public.missions
FOR ALL
TO authenticated
USING (public.is_admin());
