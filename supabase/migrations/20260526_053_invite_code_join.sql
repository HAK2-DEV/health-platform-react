-- ============================================================
-- Migration: 053 - 초대 코드 가입 RPC + programs RLS 참여자 확장
-- 작성일: 2026-05-26
-- 설명: INVITE_CODE 가입 흐름 완성.
--   기존: 운영자가 코드 설정만 가능 (Step 3 마법사). 사용자 가입 측은 검증 없이 FREE 와 동일하게 동작.
--   본인 결정 (Day 58): SECURITY DEFINER RPC 로 코드 검증 + 가입을 원자적 처리.
--                        + programs SELECT RLS 에 "ACTIVE 참여자도 본인 참여 프로그램 SELECT 허용" 확장.
--
-- 변경 1) programs SELECT RLS 확장
--   기존: owner OR (PUBLISHED + is_public)
--   추가: + ACTIVE 참여자가 본인 참여 프로그램 SELECT
--   → 비공개 (is_public=false) 초대 프로그램에 가입한 참여자가 그 프로그램을 볼 수 있게 됨.
--
-- 변경 2) join_with_invite_code(program_id, code) RPC
--   - 인증된 사용자만 호출 가능 (auth.uid IS NOT NULL)
--   - 프로그램 존재 + PUBLISHED 검증
--   - join_type='INVITE_CODE' 검증
--   - invite_code 일치 검증
--   - 이미 ACTIVE 면 already_joined / 다른 상태면 status 갱신 후 rejoined
--   - 새 참여면 INSERT
--   - 반환: { ok, reason | joined | rejoined | already_joined, program_id, program_name }
--
-- 보안:
--   - SECURITY DEFINER 로 programs/program_participants RLS 우회 (코드 검증 내부 처리)
--   - 코드 자체는 RPC 결과에 노출되지 않음 (일치 여부만 검증)
--
-- 복구:
--   supabase/rollbacks/053_revert_invite_code_join.sql 수동 실행 → 007 시점 RLS 복원 + RPC DROP.
-- ============================================================

-- ─── 1) programs SELECT RLS 확장 ──────────────────────────
DROP POLICY IF EXISTS "view programs based on status and visibility" ON public.programs;

CREATE POLICY "view programs by owner public or participation"
ON public.programs
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR (status = 'PUBLISHED' AND is_public = true)
  OR EXISTS (
    SELECT 1 FROM public.program_participants pp
    WHERE pp.program_id = programs.id
      AND pp.user_id = auth.uid()
      AND pp.status = 'ACTIVE'
  )
);


-- ─── 2) 초대 코드 가입 RPC ────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_with_invite_code(
  p_program_id UUID,
  p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
  v_program RECORD;
  v_existing_status TEXT;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT id, name, join_type, invite_code, status, owner_id
  INTO v_program
  FROM public.programs
  WHERE id = p_program_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'program_not_found');
  END IF;

  IF v_program.status != 'PUBLISHED' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'program_not_published');
  END IF;

  IF v_program.join_type != 'INVITE_CODE' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_invite_program');
  END IF;

  IF v_program.invite_code IS NULL OR trim(v_program.invite_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_code_set');
  END IF;

  IF v_program.invite_code != trim(p_code) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  -- 운영자 본인이 자기 프로그램에 코드로 가입 — 무의미하지만 방어
  IF v_program.owner_id = v_caller THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'owner_cannot_join',
                              'program_id', v_program.id, 'program_name', v_program.name);
  END IF;

  -- 이미 참여 행이 있는지
  SELECT status INTO v_existing_status
  FROM public.program_participants
  WHERE program_id = p_program_id AND user_id = v_caller;

  IF FOUND THEN
    IF v_existing_status = 'ACTIVE' THEN
      RETURN jsonb_build_object('ok', true, 'already_joined', true,
                                'program_id', v_program.id, 'program_name', v_program.name);
    ELSE
      -- PENDING/REJECTED/COMPLETED → ACTIVE 로 갱신
      UPDATE public.program_participants
      SET status = 'ACTIVE', joined_at = now()
      WHERE program_id = p_program_id AND user_id = v_caller;
      RETURN jsonb_build_object('ok', true, 'rejoined', true,
                                'program_id', v_program.id, 'program_name', v_program.name);
    END IF;
  END IF;

  INSERT INTO public.program_participants (program_id, user_id, status)
  VALUES (p_program_id, v_caller, 'ACTIVE');

  RETURN jsonb_build_object('ok', true, 'joined', true,
                            'program_id', v_program.id, 'program_name', v_program.name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_with_invite_code(UUID, TEXT) TO authenticated;
