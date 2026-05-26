-- ============================================================
-- Migration: 056 - missions SELECT RLS 에 ACTIVE 참여자 케이스 추가 (핫픽스)
-- 작성일: 2026-05-26
-- 설명: 016 missions SELECT 정책이 "owner OR (PUBLISHED+is_public)" 만 허용.
--   비공개 프로그램 (is_public=false) 의 참여자는 missions 를 SELECT 못함 →
--   verifications INSERT 의 subquery (mission_id IN (SELECT ... FROM missions JOIN ...))
--   가 빈 결과 반환 → 인증 제출 RLS 거부 ("new row violates row-level security policy").
--
-- 054 에서 programs RLS 는 _is_active_participant 헬퍼로 참여자 케이스 추가했음.
--   missions 도 같은 패턴으로 보강 — _is_active_participant 가 SECURITY DEFINER 라
--   missions 정책 안에서 호출해도 RLS 재귀 없음.
--
-- 변경:
--   missions SELECT USING 에 `OR public._is_active_participant(program_id, auth.uid())` 추가.
--
-- 복구:
--   supabase/rollbacks/056_revert_missions_rls_participant.sql 수동 실행.
-- ============================================================

DROP POLICY IF EXISTS "view missions of accessible programs" ON public.missions;

CREATE POLICY "view missions of accessible programs"
ON public.missions
FOR SELECT
TO authenticated
USING (
  program_id IN (
    SELECT id FROM public.programs
    WHERE owner_id = auth.uid()
       OR (status = 'PUBLISHED' AND is_public = true)
  )
  OR public._is_active_participant(program_id, auth.uid())
);
