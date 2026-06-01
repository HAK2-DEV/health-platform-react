-- ============================================================
-- Migration: 068 - 초대 코드 전역 UNIQUE + 코드 단독 lookup/join RPC
-- 작성일: 2026-06-01
-- 설명: 초대 코드 UX 개선 — 사용자가 프로그램 ID 없이 코드만 입력해 참여 가능.
--
--   - programs.invite_code 에 partial UNIQUE index (NULL 다수 허용, 값은 충돌 X)
--   - lookup_invite_program(code): 가입 전 프로그램 정보 미리보기 (가입 X)
--   - join_by_invite_code(code): code 단독으로 가입. 기존 join_with_invite_code 는 DROP.
--
--   하이브리드 입력: 운영자가 빈 칸이면 클라이언트가 자동 생성 (6자리 영숫자),
--   입력하면 그 값. UNIQUE 위반 시 클라이언트가 새 random 으로 재시도.
--
-- 복구:
--   supabase/rollbacks/068_revert_invite_code_unique.sql 수동 실행.
-- ============================================================

-- 1) UNIQUE 인덱스 (partial: NULL 다수 허용)
CREATE UNIQUE INDEX IF NOT EXISTS programs_invite_code_unique
  ON public.programs (invite_code)
  WHERE invite_code IS NOT NULL;


-- 2) 코드 단독 lookup (미리보기용 — 가입 X)
--    반환: { ok, program: {...} } 또는 { ok: false, reason }
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
      'owner_id', v_program.owner_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_invite_program(TEXT) TO authenticated;


-- 3) code 단독으로 가입 — 기존 join_with_invite_code 는 DROP, 새 join_by_invite_code 사용
DROP FUNCTION IF EXISTS public.join_with_invite_code(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.join_by_invite_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program public.programs%ROWTYPE;
  v_existing public.program_participants%ROWTYPE;
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

  -- 이미 참여 / 재가입 / 신규
  SELECT * INTO v_existing
  FROM public.program_participants
  WHERE program_id = v_program.id AND user_id = auth.uid();

  IF FOUND AND v_existing.status = 'ACTIVE' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_joined', true,
      'program_id', v_program.id,
      'program_name', v_program.name
    );
  END IF;

  IF FOUND THEN
    UPDATE public.program_participants
    SET status = 'ACTIVE', joined_at = now()
    WHERE id = v_existing.id;
    RETURN jsonb_build_object(
      'ok', true,
      'rejoined', true,
      'program_id', v_program.id,
      'program_name', v_program.name
    );
  END IF;

  INSERT INTO public.program_participants (program_id, user_id, status, joined_at)
  VALUES (v_program.id, auth.uid(), 'ACTIVE', now());

  RETURN jsonb_build_object(
    'ok', true,
    'program_id', v_program.id,
    'program_name', v_program.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_by_invite_code(TEXT) TO authenticated;
