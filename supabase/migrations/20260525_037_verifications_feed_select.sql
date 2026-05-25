-- ============================================================
-- Migration: 037 - verifications SELECT RLS 확장 (피드용)
-- 작성일: 2026-05-25
-- 설명: feed_enabled=true 인 프로그램의 ACTIVE 참여자끼리 서로 인증 SELECT 허용.
--   본인 메모리 항목 5 — "참여자들이 서로 인증 볼 수 있는 게시판형 UI" 의 핵심.
--
-- 기존 정책 (018 'view own or own program verifications') 동작:
--   본인 인증 + 본인 프로그램 운영자
-- 추가 (이 정책):
--   feed_enabled=true + ACTIVE 참여자 → 같은 프로그램 다른 참여자의 APPROVED 인증 SELECT
--
-- REJECTED/PENDING 은 안 보임 — APPROVED 만 (피드는 인증 완료된 활동만)
--
-- 복구:
--   supabase/rollbacks/037_revert_verifications_feed_select.sql 수동 실행.
-- ============================================================

CREATE POLICY "feed view approved verifications by program peers"
ON public.verifications
FOR SELECT
TO authenticated
USING (
  status = 'APPROVED'
  AND mission_id IN (
    SELECT m.id FROM public.missions m
    JOIN public.programs p ON p.id = m.program_id
    JOIN public.program_participants pp ON pp.program_id = p.id
    WHERE p.feed_enabled = true
      AND pp.user_id = auth.uid()
      AND pp.status = 'ACTIVE'
  )
);
