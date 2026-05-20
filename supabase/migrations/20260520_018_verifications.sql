-- ============================================================
-- Migration: 018 - verifications 테이블 + RLS + AUTO status 자동 변환 트리거
-- 작성일: 2026-05-20
-- 설명: 참여자의 미션 인증 제출 기록
--
-- status 흐름:
--   AUTO 미션  → INSERT 즉시 status='APPROVED' (BEFORE 트리거가 자동 설정)
--   MANUAL 미션→ INSERT 시 status='PENDING_REVIEW', 운영자 UPDATE 로 APPROVED/REJECTED
--   SUBMITTED 상태는 외부 시스템 연동용으로 예약 (현재 미사용)
--
-- image_path: Storage 버킷 'verification-images' 의 경로
--   예: '{user_id}/{timestamp}.jpg'
--   Storage 버킷은 다음 단계(인증 UI 만들 때) 같이 생성
--
-- daily_limit 검증: 020 score_ledgers 트리거에서 점수 부여 시 처리
--   (verifications INSERT 자체는 허용. 활동 기록은 보존, 점수만 제한)
-- ============================================================

CREATE TABLE public.verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  image_path TEXT,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewer_id UUID REFERENCES public.users(id)
);

-- 인덱스
CREATE INDEX idx_verifications_mission ON public.verifications(mission_id);
CREATE INDEX idx_verifications_user ON public.verifications(user_id);
CREATE INDEX idx_verifications_status ON public.verifications(status);

-- RLS 활성화
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- RLS 정책
-- ============================================================

-- SELECT: 본인의 인증 + 본인이 운영하는 프로그램의 인증 (심사용)
CREATE POLICY "view own or own program verifications"
ON public.verifications
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR
  mission_id IN (
    SELECT m.id FROM public.missions m
    JOIN public.programs p ON p.id = m.program_id
    WHERE p.owner_id = auth.uid()
  )
);

-- INSERT: 본인 인증만 + ACTIVE 참여 중인 프로그램의 미션만
CREATE POLICY "users can submit verification"
ON public.verifications
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND
  mission_id IN (
    SELECT m.id
    FROM public.missions m
    JOIN public.program_participants pp ON pp.program_id = m.program_id
    WHERE pp.user_id = auth.uid() AND pp.status = 'ACTIVE'
  )
);

-- UPDATE: 운영자만 (심사용). 참여자는 자기 인증을 수정 불가 (점수 조작 방지)
CREATE POLICY "owners can update verifications"
ON public.verifications
FOR UPDATE
TO authenticated
USING (
  mission_id IN (
    SELECT m.id FROM public.missions m
    JOIN public.programs p ON p.id = m.program_id
    WHERE p.owner_id = auth.uid()
  )
);

-- DELETE: 본인 (취소) + 운영자
CREATE POLICY "self and owners can delete verifications"
ON public.verifications
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR
  mission_id IN (
    SELECT m.id FROM public.missions m
    JOIN public.programs p ON p.id = m.program_id
    WHERE p.owner_id = auth.uid()
  )
);

-- ADMIN: 모든 작업
CREATE POLICY "admins can do anything on verifications"
ON public.verifications
FOR ALL
TO authenticated
USING (public.is_admin());


-- ============================================================
-- BEFORE INSERT 트리거: 미션의 verification_type 에 따라 status 자동 설정
--   - 참여자가 status 를 어떤 값으로 보내든 트리거가 다시 결정 (조작 방지)
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_verification_status_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verification_type TEXT;
BEGIN
  SELECT verification_type
  INTO v_verification_type
  FROM public.missions
  WHERE id = NEW.mission_id;

  IF v_verification_type = 'AUTO' THEN
    NEW.status := 'APPROVED';
    NEW.reviewed_at := NOW();
  ELSIF v_verification_type = 'MANUAL' THEN
    NEW.status := 'PENDING_REVIEW';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_status_before_verification_insert ON public.verifications;
CREATE TRIGGER set_status_before_verification_insert
BEFORE INSERT ON public.verifications
FOR EACH ROW
EXECUTE FUNCTION public.set_verification_status_on_insert();
