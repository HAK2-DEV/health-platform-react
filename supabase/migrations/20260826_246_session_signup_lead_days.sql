-- ============================================================
-- Migration: 246 - 클래스(세션)별 신청 개방 시점 개별 설정
-- 작성일: 2026-08-26
-- 설명:
--   245는 프로그램 전체 기본값(programs.class_signup_lead_days)이었고,
--   이제 각 클래스(세션)마다 개별로 "시작 N일 전부터 신청"을 설정할 수 있게 한다.
--   sessions.signup_lead_days: NULL = 프로그램 기본값(programs.class_signup_lead_days)을 따름.
--                              0 = 항상 열림, 7 = 시작 1주 전부터 등.
--   게이팅은 참여자 화면(ClassDetail): 세션값 우선, 없으면 프로그램 기본값.
--
-- 복구:
--   ALTER TABLE public.sessions DROP COLUMN IF EXISTS signup_lead_days;
-- ============================================================

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS signup_lead_days INT;
