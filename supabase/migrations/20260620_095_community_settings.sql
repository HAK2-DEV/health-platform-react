-- ============================================================
-- Migration: 095 - 커뮤니티 관리자 설정 (게시판/승인노출/신고정책)
-- 작성일: 2026-06-20
-- 설명:
--   커뮤니티 관리자의 ②게시판 카테고리 ③승인·노출 ④신고 정책 설정을
--   programs.community_settings (JSONB) 한 곳에 저장. (자주 바뀌는 운영 옵션 묶음)
--   기본값:
--     boards: 시스템 게시판 4종 (전체/공지/인증/자유)
--     postApproval(승인 후 노출) / noticeEnabled(공지 사용) /
--     reactionAuto(반응 자동) / previewCard(미리보기 카드) / reportPolicy(신고 정책)
--   ⚠ 설정 저장만 추가. 실제 작동(승인 흐름·신고 자동숨김·자유게시판 글쓰기)은 후속.
--
-- 복구: ALTER TABLE public.programs DROP COLUMN IF EXISTS community_settings;
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS community_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
