-- ============================================================
-- Migration: 245 - 클래스 신청 개방 시점(며칠 전부터 신청 가능) 운영자 설정
-- 작성일: 2026-08-26
-- 설명:
--   운영자가 주차별 클래스를 미리 만들어두면 참여자가 5주 뒤 클래스까지 즉시
--   신청 가능하던 문제 해결. programs.class_signup_lead_days 로
--   "시작 N일 전부터 신청 열림"을 설정한다.
--   NULL 또는 0 = 항상 열림(기존 동작, 하위호환). 예: 7 = 시작 1주 전부터 신청.
--   게이팅은 참여자 화면(ClassDetail)에서 처리, 이 컬럼은 설정값 저장용.
--
-- 복구:
--   ALTER TABLE public.programs DROP COLUMN IF EXISTS class_signup_lead_days;
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS class_signup_lead_days INT;
