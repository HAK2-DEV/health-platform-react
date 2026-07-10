-- ============================================================
-- Migration: 156 - programs.card_home 백필 (기존 프로그램도 카드형 홈 적용)
-- 작성일: 2026-07-10
-- 설명:
--   카드형 홈(card_home) 을 신규 프로그램뿐 아니라 "이전에 만들어진 모든 프로그램"에도 적용.
--   card_home 을 읽어 렌더하는 코드(usesCardHome)는 달리기(RUNNING)·금연(QUIT_SMOKING)
--   테마를 자동 제외하므로, 그 테마 프로그램은 card_home=true 여도 기존 전용 UI 를 유지(무해).
--   기본값도 true 로 바꿔 향후 삽입 누락 시에도 카드홈이 기본이 되게 함.
--
-- 영향: programs 데이터 UPDATE(백필) + 컬럼 DEFAULT 변경. 추가/하위호환:
--   card_home 을 렌더에 쓰는 신규 코드가 배포되기 전에는 프로드 동작 불변(inert),
--   배포 후 기존 프로그램도 카드형 홈으로 표시됨.
--
-- 복구:
--   ALTER TABLE public.programs ALTER COLUMN card_home SET DEFAULT false;
--   (개별 되돌림이 필요하면 특정 program id 만 card_home=false 로 UPDATE)
-- ============================================================

-- 1) 기존 프로그램 전부 카드형 홈으로
UPDATE public.programs
SET card_home = true
WHERE card_home IS NOT TRUE;

-- 2) 향후 기본값도 카드형 홈
ALTER TABLE public.programs
  ALTER COLUMN card_home SET DEFAULT true;
