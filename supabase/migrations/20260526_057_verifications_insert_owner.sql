-- ============================================================
-- Migration: 057 - verifications INSERT 정책에 운영자도 허용
-- 작성일: 2026-05-26
-- 설명: 018 의 INSERT 정책은 "ACTIVE 참여자" 만 허용 → 운영자 본인이 자기 프로그램
--   미션을 테스트/시범 인증 못 함. 본인 결정 — 운영자도 자기 프로그램에서는 인증 가능.
--
-- 변경:
--   기존: mission_id IN (... JOIN program_participants WHERE pp.status='ACTIVE' AND pp.user_id=uid)
--   신규: + 또는 missions 의 program owner 가 본인
--
-- 보안:
--   user_id = auth.uid() 는 그대로 유지 — 본인 인증만 INSERT
--   추가된 owner 케이스로 다른 사람 인증 INSERT 위험 없음
--   _is_active_participant 헬퍼 활용 → 054 와 일관
--
-- 복구:
--   supabase/rollbacks/057_revert_verifications_insert_owner.sql 수동 실행.
-- ============================================================

DROP POLICY IF EXISTS "users can submit verification" ON public.verifications;

CREATE POLICY "users can submit verification"
ON public.verifications
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND mission_id IN (
    SELECT m.id
    FROM public.missions m
    JOIN public.programs p ON p.id = m.program_id
    WHERE p.owner_id = auth.uid()
       OR public._is_active_participant(p.id, auth.uid())
  )
);
