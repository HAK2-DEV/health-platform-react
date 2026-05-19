-- ============================================================
-- Migration: 001 - users 테이블
-- 작성일: 2026-05-19
-- 설명: public.users 테이블 만들기 + RLS 활성화
--
-- public.users 는 auth.users 와 1:1 연결된 사용자 프로필 테이블.
-- 닉네임, 역할, 닉네임 변경 시간 등을 저장한다.
-- ============================================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nickname TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'USER' 
    CHECK (role IN ('USER', 'ADMIN')),
  nickname_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화 (정책은 003 마이그레이션에서)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;