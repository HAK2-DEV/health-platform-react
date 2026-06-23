-- ============================================================
-- Migration: 123 - 비공개(초대코드)+운영자 승인도 입장 질문/답변 받기
-- 작성일: 2026-06-23
-- 설명:
--   초대 링크가 외부로 유출될 수 있어, 비공개+승인 프로그램도 입장 질문으로 신청자를 거를 수 있게.
--   1) lookup_invite_program 반환에 entry_question 추가 (미리보기에서 답변칸 노출 판단용)
--   2) join_by_invite_code 에 p_entry_answer 파라미터 추가 — 승인 대기(PENDING)면 답변 저장.
--      입장 질문이 있는데 답변이 비면 거부(entry_answer_required).
--   기존 단일 인자 버전은 모호성 방지 위해 DROP 후 (p_code, p_entry_answer DEFAULT NULL) 로 재생성.
--
-- 복구: 090(lookup) / 089(join) 의 함수 본문으로 CREATE OR REPLACE.
--       (단 join 은 DROP FUNCTION join_by_invite_code(TEXT,TEXT) 후 089 재실행)
-- ============================================================

-- 1) lookup — entry_question 포함
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
GRANT EXECUTE ON FUNCTION public.lookup_invite_program(TEXT) TO authenticated;

-- 2) join — 입장 답변(p_entry_answer) 받아 저장 + 검증
DROP FUNCTION IF EXISTS public.join_by_invite_code(TEXT);

CREATE OR REPLACE FUNCTION public.join_by_invite_code(p_code TEXT, p_entry_answer TEXT DEFAULT NULL)
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
  v_answer TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_program FROM public.programs WHERE invite_code = TRIM(p_code) LIMIT 1;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code'); END IF;
  IF v_program.status IS DISTINCT FROM 'PUBLISHED' THEN RETURN jsonb_build_object('ok', false, 'reason', 'program_not_published'); END IF;
  IF v_program.join_type IS DISTINCT FROM 'INVITE_CODE' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_invite_program'); END IF;
  IF v_program.owner_id = auth.uid() THEN RETURN jsonb_build_object('ok', false, 'reason', 'owner_cannot_join'); END IF;

  v_pending := v_program.invite_requires_approval;
  v_status := CASE WHEN v_pending THEN 'PENDING' ELSE 'ACTIVE' END;
  v_answer := NULLIF(btrim(p_entry_answer), '');

  -- 입장 질문이 있는 승인 프로그램인데 답변이 비면 거부
  IF v_pending AND v_program.entry_question IS NOT NULL AND v_answer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'entry_answer_required');
  END IF;

  SELECT * INTO v_existing
  FROM public.program_participants
  WHERE program_id = v_program.id AND user_id = auth.uid();

  IF FOUND AND v_existing.status = 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', true, 'already_joined', true, 'pending', false, 'program_id', v_program.id, 'program_name', v_program.name);
  END IF;

  IF FOUND AND v_existing.status = 'PENDING' THEN
    RETURN jsonb_build_object('ok', true, 'pending', true, 'already_applied', true, 'program_id', v_program.id, 'program_name', v_program.name);
  END IF;

  IF FOUND THEN
    UPDATE public.program_participants
    SET status = v_status, joined_at = now(), left_at = NULL,
        entry_answer = CASE WHEN v_pending THEN v_answer ELSE NULL END
    WHERE id = v_existing.id;
    RETURN jsonb_build_object('ok', true, 'rejoined', true, 'pending', v_pending, 'program_id', v_program.id, 'program_name', v_program.name);
  END IF;

  INSERT INTO public.program_participants (program_id, user_id, status, joined_at, entry_answer)
  VALUES (v_program.id, auth.uid(), v_status, now(), CASE WHEN v_pending THEN v_answer ELSE NULL END);

  RETURN jsonb_build_object('ok', true, 'pending', v_pending, 'program_id', v_program.id, 'program_name', v_program.name);
END;
$$;
GRANT EXECUTE ON FUNCTION public.join_by_invite_code(TEXT, TEXT) TO authenticated;
