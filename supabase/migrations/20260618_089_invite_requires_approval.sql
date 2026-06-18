-- ============================================================
-- Migration: 089 - 초대코드 입장 시 승인 옵션 (자동가입 / 운영자 승인)
-- 작성일: 2026-06-18
-- 설명:
--   본인 결정: 비공개 프로그램은 초대코드로 모집한다. 코드가 유출될 수 있으니,
--   "코드 입력 시 자동 가입" vs "코드 입력 후에도 운영자 승인 필요" 를 선택 가능하게.
--
--   - programs.invite_requires_approval (신규, 기본 false=자동가입)
--   - join_by_invite_code(code): invite_requires_approval=true 면 status='PENDING'
--       (승인 대기)로, false 면 'ACTIVE' 로 가입. 재가입도 동일 규칙.
--   - lookup_invite_program(code): join_type / invite_requires_approval 도 반환
--       → 클라이언트가 "참여하기" vs "참여 신청하기" 분기.
--
--   기본 false → 기존 INVITE_CODE 프로그램은 자동가입 그대로 (하위호환).
--
-- 복구: 컬럼 DROP + 068 의 RPC 원본으로 CREATE OR REPLACE.
-- ============================================================

-- 1) 컬럼 추가 (기본 false = 자동가입)
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS invite_requires_approval BOOLEAN NOT NULL DEFAULT false;

-- 2) lookup — join_type / invite_requires_approval 반환 추가
CREATE OR REPLACE FUNCTION public.lookup_invite_program(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program public.programs%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_program
  FROM public.programs
  WHERE invite_code = TRIM(p_code)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;
  IF v_program.status IS DISTINCT FROM 'PUBLISHED' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'program_not_published');
  END IF;
  IF v_program.join_type IS DISTINCT FROM 'INVITE_CODE' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_invite_program');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'program', jsonb_build_object(
      'id', v_program.id,
      'name', v_program.name,
      'description', v_program.description,
      'start_date', v_program.start_date,
      'end_date', v_program.end_date,
      'categories', v_program.categories,
      'cover_image_path', v_program.cover_image_path,
      'max_participants', v_program.max_participants,
      'owner_id', v_program.owner_id,
      'join_type', v_program.join_type,
      'invite_requires_approval', v_program.invite_requires_approval
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_invite_program(TEXT) TO authenticated;

-- 3) join — 승인 필요 시 PENDING, 아니면 ACTIVE
CREATE OR REPLACE FUNCTION public.join_by_invite_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program public.programs%ROWTYPE;
  v_existing public.program_participants%ROWTYPE;
  v_status TEXT;
  v_pending BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_program
  FROM public.programs
  WHERE invite_code = TRIM(p_code)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;
  IF v_program.status IS DISTINCT FROM 'PUBLISHED' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'program_not_published');
  END IF;
  IF v_program.join_type IS DISTINCT FROM 'INVITE_CODE' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_invite_program');
  END IF;
  IF v_program.owner_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'owner_cannot_join');
  END IF;

  v_pending := v_program.invite_requires_approval;
  v_status := CASE WHEN v_pending THEN 'PENDING' ELSE 'ACTIVE' END;

  -- 이미 참여 / 재가입 / 신규
  SELECT * INTO v_existing
  FROM public.program_participants
  WHERE program_id = v_program.id AND user_id = auth.uid();

  IF FOUND AND v_existing.status = 'ACTIVE' THEN
    RETURN jsonb_build_object(
      'ok', true, 'already_joined', true, 'pending', false,
      'program_id', v_program.id, 'program_name', v_program.name
    );
  END IF;

  IF FOUND AND v_existing.status = 'PENDING' THEN
    RETURN jsonb_build_object(
      'ok', true, 'pending', true, 'already_applied', true,
      'program_id', v_program.id, 'program_name', v_program.name
    );
  END IF;

  IF FOUND THEN
    UPDATE public.program_participants
    SET status = v_status, joined_at = now(), left_at = NULL
    WHERE id = v_existing.id;
    RETURN jsonb_build_object(
      'ok', true, 'rejoined', true, 'pending', v_pending,
      'program_id', v_program.id, 'program_name', v_program.name
    );
  END IF;

  INSERT INTO public.program_participants (program_id, user_id, status, joined_at)
  VALUES (v_program.id, auth.uid(), v_status, now());

  RETURN jsonb_build_object(
    'ok', true, 'pending', v_pending,
    'program_id', v_program.id, 'program_name', v_program.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_by_invite_code(TEXT) TO authenticated;
