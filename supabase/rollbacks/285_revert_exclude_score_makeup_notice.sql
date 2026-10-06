-- ============================================================
-- Rollback: 285 - 점수 제외 알림의 만회 안내 되돌리기
-- 작성일: 2026-10-06
--   exclude_verification_score 를 113 원문으로 되돌린다(아래 본문은 20260623_113 파일에서 그대로 잘라 붙임).
-- ============================================================

CREATE OR REPLACE FUNCTION public.exclude_verification_score(
  p_verification_id UUID,
  p_reason TEXT
)
RETURNS public.verifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.verifications;
  v_owner UUID;
  v_mission_title TEXT;
  v_program_id UUID;
  v_program_name TEXT;
  v_reason TEXT;
BEGIN
  v_reason := NULLIF(btrim(p_reason), '');

  SELECT p.owner_id, m.title, m.program_id, p.name
  INTO v_owner, v_mission_title, v_program_id, v_program_name
  FROM public.verifications ver
  JOIN public.missions m ON m.id = ver.mission_id
  JOIN public.programs p ON p.id = m.program_id
  WHERE ver.id = p_verification_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '인증을 찾을 수 없습니다';
  END IF;
  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION '프로그램 운영자만 점수를 제외할 수 있습니다';
  END IF;

  DELETE FROM public.score_ledgers WHERE verification_id = p_verification_id;

  UPDATE public.verifications
  SET status = 'REJECTED',
      rejection_reason = v_reason,
      reviewed_at = NOW(),
      reviewer_id = auth.uid()
  WHERE id = p_verification_id
  RETURNING * INTO v_row;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
  VALUES (
    v_row.user_id,
    'REVIEW_REJECTED',
    '⚠️ 인증이 점수에서 제외됐어요',
    v_program_name || E'\n' || v_mission_title
      || CASE WHEN v_reason IS NOT NULL THEN E'\n사유: ' || v_reason ELSE '' END,
    NULL,
    'verifications',
    v_row.id
  );

  RETURN v_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.exclude_verification_score(UUID, TEXT) TO authenticated;
