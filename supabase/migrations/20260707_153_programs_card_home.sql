-- ============================================================
-- Migration: 153 - programs.card_home (카드형 홈 레이아웃 플래그)
-- 작성일: 2026-07-07
-- 설명:
--   표준 프로그램 상세를 달리기(RunningHome)처럼 "카드형 홈"(탭바 제거)으로 전환하는 개편.
--   본인 결정(2026-07-07): 기존 프로그램은 그대로 탭형 유지, 신규 생성 프로그램만 카드형 적용.
--   → card_home=false(기본, 기존 행) = 탭형 / true(신규 생성 코드가 지정) = 카드형 홈.
--   달리기/금연 테마는 각자 전용 홈이 있으므로 코드에서 표준 테마에만 적용(테마로 게이트).
--
-- 영향: programs 에 nullable 아님 + DEFAULT false 컬럼 1개 추가. 기존 행은 false → 동작 불변.
--   이 마이그레이션만 먼저 올라가도 기존 코드는 card_home 을 읽지 않으므로 그대로 동작.
--
-- 복구:
--   ALTER TABLE public.programs DROP COLUMN IF EXISTS card_home;
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS card_home BOOLEAN NOT NULL DEFAULT false;
