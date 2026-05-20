-- ============================================================
-- Migration: 005 - programs 테이블 (MVP 1차)
-- 작성일: 2026-05-19
-- 설명: public.programs 테이블 만들기 + RLS 활성화
--
-- MVP 1차 컬럼만 포함. 마법사 단계별로 컬럼 진화 예정.
-- - 기본 정보: name, description, start_date, end_date (마법사 1단계)
-- - 상태 관리: status, published_at
-- - 미래 추가: join_types, ranking_scopes, short_url, qr_code_url
--
-- status 의미:
--   DRAFT     - 마법사 진행 중 (임시 저장)
--   PUBLISHED - 게시 완료 (참여자 모집 + 운영 중)
--   ENDED     - 운영 종료
--   ARCHIVED  - 보관됨 (목록에서 숨김)
-- ============================================================

CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 기본 정보
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  
  -- 상태 관리
  status TEXT NOT NULL DEFAULT 'DRAFT' 
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ENDED', 'ARCHIVED')),
  
  -- 시간 추적
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 본인이 자주 조회할 쿼리에 인덱스 미리 추가
CREATE INDEX idx_programs_owner_id ON public.programs(owner_id);
CREATE INDEX idx_programs_status ON public.programs(status);

-- RLS 활성화 (정책은 006 마이그레이션에서)
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;