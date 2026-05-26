-- ============================================================
-- Migration: 054 - programs RLS 무한 재귀 핫픽스
-- 작성일: 2026-05-26
-- 설명: 053 의 programs SELECT 정책이 program_participants 를 EXISTS 로 참조.
--   그런데 015 의 program_participants SELECT 정책이 programs 를 IN 서브쿼리로 참조.
--   → 두 정책이 서로를 호출하며 무한 재귀 (Postgres 42P17 'infinite recursion detected in policy').
--
-- 해결: programs 정책의 participants 체크를 SECURITY DEFINER 함수로 분리.
--   함수 안에선 RLS 가 적용되지 않아 program_participants 를 직접 SELECT 해도 재귀 없음.
--
-- 복구:
--   supabase/rollbacks/054_revert_fix_programs_rls_recursion.sql 수동 실행 → 053 시점으로 (재귀 다시 발생).
-- ============================================================

-- ─── 1) SECURITY DEFINER 헬퍼 ──────────────────────────────
CREATE OR REPLACE FUNCTION public._is_active_participant(
  p_program_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.program_participants
    WHERE program_id = p_program_id
      AND user_id = p_user_id
      AND status = 'ACTIVE'
  );
$$;

GRANT EXECUTE ON FUNCTION public._is_active_participant(UUID, UUID) TO authenticated;


-- ─── 2) programs SELECT 정책 재작성 (헬퍼 사용) ───────────
DROP POLICY IF EXISTS "view programs by owner public or participation" ON public.programs;

CREATE POLICY "view programs by owner public or participation"
ON public.programs
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR (status = 'PUBLISHED' AND is_public = true)
  OR public._is_active_participant(id, auth.uid())
);
