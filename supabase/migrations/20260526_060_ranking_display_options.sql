-- ============================================================
-- Migration: 060 - 랭킹 부가 표시 옵션 (운영자 선택)
-- 작성일: 2026-05-26
-- 설명: 운영자가 랭킹 페이지에서 추가 시각화를 표시할지 선택할 수 있게
--       programs 테이블에 두 BOOLEAN 컬럼 추가.
--   - trend_enabled: 참여자 본인 14일 점수 추세 스파크라인 노출
--   - period_filter_enabled: 시간 범위 토글 (전체 / 최근 7일 / 최근 30일) 노출
--
-- 둘 다 DEFAULT false — 기존 프로그램은 기본 비활성 (UI 단순 유지).
-- 운영자가 마법사 Step 2 또는 ProgramEditModal 에서 토글로 켤 수 있음.
--
-- 두 옵션 모두 ranking_enabled=false 면 의미 없음 — 클라이언트 측에서 분기.
-- (DB 제약은 두지 않음 — 운영자가 ranking_enabled 만 켰다 껐다 할 때 데이터 보존)
--
-- 복구:
--   supabase/rollbacks/060_revert_ranking_display_options.sql 수동 실행.
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS trend_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS period_filter_enabled BOOLEAN NOT NULL DEFAULT false;
