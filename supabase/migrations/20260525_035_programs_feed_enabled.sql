-- ============================================================
-- Migration: 035 - programs.feed_enabled 컬럼 추가 (커뮤니티 피드 활성 여부)
-- 작성일: 2026-05-25
-- 설명: COMMUNITY 게시판형 — 본인 메모리 항목 6번 + 항목 5번.
--   운영자가 마법사에서 토글로 "이 프로그램에 피드 활성화" 결정.
--   true 면 같은 프로그램 참여자끼리 verifications SELECT 허용 (037 RLS 확장).
--   false (디폴트) 면 기존 동작 — 본인 인증 + 운영자만 SELECT.
--
-- program_type 별도 분기 X — 운영자가 어떤 유형이든 피드 활성화 가능 (유연).
--
-- 복구:
--   supabase/rollbacks/035_revert_programs_feed_enabled.sql 수동 실행.
-- ============================================================

ALTER TABLE public.programs
ADD COLUMN feed_enabled BOOLEAN NOT NULL DEFAULT false;
