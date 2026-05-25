-- ============================================================
-- Migration: 039 - verifications.feed_visible 컬럼 추가 (커뮤니티 노출 선택)
-- 작성일: 2026-05-25
-- 설명: 사용자가 미션 제출 시 "이 인증을 피드에 보일지" 선택 가능.
--   소감·사진을 다른 참여자에게 노출 꺼리는 사용자 배려.
--   점수 부여는 영향 없음 — 피드 표시 여부만 결정.
--
-- 디폴트 true — 기본은 노출 (참여자 활동 활성화 + 사회적 응원 유도)
--   사용자가 명시적으로 끄면 false (피드에서 숨김)
--   feed_enabled=false 인 프로그램은 어차피 피드 없음 (값 무의미)
--
-- 복구:
--   supabase/rollbacks/039_revert_verifications_feed_visible.sql 수동 실행.
-- ============================================================

ALTER TABLE public.verifications
ADD COLUMN feed_visible BOOLEAN NOT NULL DEFAULT true;
