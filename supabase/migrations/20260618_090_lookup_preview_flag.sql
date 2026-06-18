-- ============================================================
-- Migration: 090 - lookup_invite_program 이 preview_enabled 반환
-- 작성일: 2026-06-18
-- 설명:
--   초대 코드 미리보기 화면(JoinByCodePage)에서 "둘러보기" 버튼 노출 여부를 알려면
--   preview_enabled 가 필요. 비공개 프로그램은 RLS 로 비참여자가 programs 행을 직접
--   SELECT 못 하므로(SECURITY DEFINER 인) lookup RPC 반환에 preview_enabled 추가.
--
--   089 의 lookup_invite_program 을 CREATE OR REPLACE — preview_enabled 만 추가.
--   join_by_invite_code 는 변경 없음.
--
-- 복구: 089 의 lookup 정의로 CREATE OR REPLACE.
-- ============================================================

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
      'invite_requires_approval', v_program.invite_requires_approval,
      'preview_enabled', v_program.preview_enabled
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_invite_program(TEXT) TO authenticated;
