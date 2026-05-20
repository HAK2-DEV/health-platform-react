-- ============================================================
-- Migration: 013 - programs 의 참여 조건 진화
-- 작성일: 2026-05-20
-- 설명: 마법사 5단계의 참여 조건 (SSRD 진화 따라)
--
-- 옛 컬럼 삭제: join_types TEXT[] (복수 선택 패턴)
-- 새 컬럼들:
--   join_type TEXT - 참여 방식 (단일 선택)
--     'FREE'        - 공개 참여 (누구나)
--     'APPROVAL'    - 승인 후 참여 (운영자 승인 필요)
--     'INVITE_CODE' - 초대 코드 참여
--   max_participants INT - 최대 참여 인원 (null = 무제한)
--   is_public BOOLEAN - 공개 검색 여부
--   invite_code TEXT - 초대 코드 (INVITE_CODE 모드 시)
--
-- RLS 정책 진화: join_types 사용 → is_public 사용
-- ============================================================

-- 1. 옛 RLS 정책 삭제 (join_types 사용)
DROP POLICY IF EXISTS "view programs based on status and visibility" ON public.programs;

-- 2. 옛 인덱스 삭제 (join_types 사용)
DROP INDEX IF EXISTS idx_programs_join_types;

-- 3. 옛 컬럼 삭제
ALTER TABLE public.programs DROP COLUMN join_types;

-- 4. 새 컬럼 추가
ALTER TABLE public.programs
ADD COLUMN join_type TEXT 
  CHECK (join_type IS NULL OR join_type IN ('FREE', 'APPROVAL', 'INVITE_CODE'));

ALTER TABLE public.programs
ADD COLUMN max_participants INT;

ALTER TABLE public.programs
ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.programs
ADD COLUMN invite_code TEXT;

-- 5. 새 RLS 정책 (is_public 사용)
CREATE POLICY "view programs based on status and visibility"
ON public.programs 
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR
  (status = 'PUBLISHED' AND is_public = true)
);

-- 6. 인덱스 (공개 프로그램 검색)
CREATE INDEX idx_programs_is_public ON public.programs(is_public) 
  WHERE is_public = true;