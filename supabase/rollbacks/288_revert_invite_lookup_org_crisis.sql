-- 288 되돌리기 — lookup_invite_program 을 123 의 본문(org_name·crisis_line_enabled 없음)으로. 권한은 그대로.
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

  SELECT * INTO v_program FROM public.programs WHERE invite_code = TRIM(p_code) LIMIT 1;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code'); END IF;
  IF v_program.status IS DISTINCT FROM 'PUBLISHED' THEN RETURN jsonb_build_object('ok', false, 'reason', 'program_not_published'); END IF;
  IF v_program.join_type IS DISTINCT FROM 'INVITE_CODE' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_invite_program'); END IF;

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
      'preview_enabled', v_program.preview_enabled,
      'entry_question', v_program.entry_question
    )
  );
END;
$$;
