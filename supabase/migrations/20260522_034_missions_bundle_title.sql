-- ============================================================
-- Migration: 034 - missions 에 bundle_title 컬럼 추가 (그루핑 키)
-- 작성일: 2026-05-22
-- 설명: 추천 미션 라이브러리에서 묶음으로 INSERT 한 미션들을
--       프로그램 상세 화면에서 한 묶음 카드로 그루핑하기 위한 정보.
--
-- bundle_title TEXT NULLABLE:
--   - NULL  : 단독 미션 (운영자가 "직접 만들기" 로 추가한 미션)
--   - NOT NULL : 라이브러리 묶음 소속 (예: "🌙 수면 회복 루틴")
--               같은 program_id + 같은 bundle_title 끼리 UI 에서 한 카드로 묶임
--
-- 점수/인증/RLS 영향 없음 — 순수 UI 그루핑 메타.
--   verifications, score_ledgers, 점수 트리거(033)는 그대로.
--
-- 복구:
--   supabase/rollbacks/034_revert_missions_bundle_title.sql 수동 실행.
-- ============================================================

ALTER TABLE public.missions
ADD COLUMN bundle_title TEXT;
