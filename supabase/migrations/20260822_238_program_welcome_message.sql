-- ============================================================
-- Migration: 238 - 프로그램 참여자 환영 메시지
-- 작성일: 2026-08-22
-- 설명:
--   참여자가 승인/가입 후 처음 프로그램에 들어왔을 때 보여줄 「환영 시트」의
--   운영자 작성 문구. NULL 이면 클라이언트가 기본 환영 문구로 폴백한다.
--   운영자 브랜드 톤을 참여자 첫인상에 싣기 위함(운영자 플랫폼 방향).
--
--   컬럼 추가(nullable)뿐이라 additive·하위호환. 기존 행은 NULL → 기본 문구.
--   RLS 변경 없음 — programs SELECT 는 이미 참여자/열람자에게 허용(007/054/237).
--
-- 복구:
--   ALTER TABLE public.programs DROP COLUMN IF EXISTS welcome_message;
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS welcome_message TEXT;
