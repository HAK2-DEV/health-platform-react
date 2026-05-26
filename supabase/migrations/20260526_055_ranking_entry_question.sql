-- ============================================================
-- Migration: 055 - 랭킹 표시 옵션 + 입장 질문 (APPROVAL 가입 확장)
-- 작성일: 2026-05-26
-- 설명: 본인 결정 (Day 58) — 3가지 옵션 추가:
--   1) programs.ranking_enabled BOOLEAN DEFAULT true
--      - 운영자가 끄면 랭킹 페이지/프로그램 상세에서 랭킹 섹션 숨김
--      - 단순 습관 형성용 프로그램 (경쟁 X) 에 유용
--   2) programs.entry_question TEXT NULL
--      - APPROVAL 가입 시 운영자가 묻고 싶은 질문
--      - NULL 이면 질문 없이 바로 신청 → PENDING
--      - 값 있으면 참여자가 답변 입력 → PENDING + entry_answer
--   3) program_participants.entry_answer TEXT NULL
--      - APPROVAL 신청 시 참여자의 답변 저장
--      - 운영자가 승인/거절 결정 시 참고
--
-- 기존 행 호환:
--   - ranking_enabled DEFAULT true → 기존 프로그램 영향 X (랭킹 그대로 노출)
--   - entry_question NULL → 기존 APPROVAL 프로그램은 질문 없이 가입 (현재 동작)
--   - entry_answer NULL → 기존 참여 행은 답변 없음 (자연스러움)
--
-- 복구:
--   supabase/rollbacks/055_revert_ranking_entry_question.sql 수동 실행.
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS ranking_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS entry_question  TEXT;

ALTER TABLE public.program_participants
  ADD COLUMN IF NOT EXISTS entry_answer TEXT;

COMMENT ON COLUMN public.programs.ranking_enabled IS
  '랭킹 표시 여부. false 이면 랭킹/포디움 숨김 (습관 형성 전용 프로그램).';
COMMENT ON COLUMN public.programs.entry_question IS
  'APPROVAL 가입 시 운영자가 신청자에게 묻는 질문. NULL 이면 질문 없이 신청.';
COMMENT ON COLUMN public.program_participants.entry_answer IS
  'APPROVAL 신청 시 참여자가 entry_question 에 대해 입력한 답변.';
