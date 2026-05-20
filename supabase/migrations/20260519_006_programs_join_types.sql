-- ============================================================
-- Migration: 006 - programs 의 join_types 컬럼 추가
-- 작성일: 2026-05-19
-- 설명: 운영자가 프로그램의 공개 방식 선택 가능
--
-- join_types TEXT[] - 운영자가 선택 (복수 선택 가능)
--   'PUBLIC_SEARCH' - 공개 검색 (누구나 둘러보기 + 참여)
--   'INVITE_LINK'   - 초대 링크/QR
--   'BULK_REGISTER' - 일괄 등록 (운영자가 명단 직접 추가)
--
-- 이 컬럼이 RLS SELECT 정책의 진짜 핵심:
--   PUBLISHED 이고 'PUBLIC_SEARCH' 포함 = 모든 사용자 SELECT
--   그 외 = owner 만 SELECT (참여자는 별도 program_participants 통해)
-- ============================================================

ALTER TABLE public.programs
ADD COLUMN join_types TEXT[] NOT NULL DEFAULT '{}';

-- 인덱스 (PUBLIC_SEARCH 포함 여부 빠른 검색)
CREATE INDEX idx_programs_join_types ON public.programs USING GIN (join_types);