-- ============================================================
-- Migration: 285 - 점수 제외 알림에도 만회 안내 (283 후속)
-- 작성일: 2026-10-06
-- 설명:
--   283(만회 인증)은 운영자 심사 반려 알림(114 트리거)에만 「24시간 안에 다시 올리면 원래 날로 인정돼요」를 붙였다.
--   그런데 자동 승인 인증에서 운영자가 «점수 제외»를 한 것도 반려다(상태 REJECTED·반려 시각 = 제외한 시각).
--   만회 규칙이 똑같이 적용되는데, 이 알림은 트리거가 아니라 exclude_verification_score 함수가 직접 보내서 안내가 빠져 있었다
--   (114 트리거는 «심사 대기 → 결과»일 때만 돈다).
--   → 113 원문에 같은 안내 한 줄만 더한다. 같은 인증(묶음)의 세 번째 반려면 「이 날짜 인증은 마감됐어요」.
--
--   하위호환: 함수 1개 교체(알림 본문 끝 한 줄 외에는 113 원문 그대로). 283 의 만회 열(makeup_root)을 읽으므로 283 다음에 적용.
--     안내 문구가 «다시 올리기» 화면을 약속하므로 화면 배포와 같은 날 적용한다. [[feedback_deploy_safety]]
--
-- 복구: supabase/rollbacks/285_revert_exclude_score_makeup_notice.sql (113 원문으로)
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
  v_rejects INT;
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

  -- 만회 안내(283) — 이 제외까지 묶음의 반려 수. 3번째면 마감, 아니면 24시간 안 만회
  SELECT count(*) INTO v_rejects
  FROM public.verifications o
  WHERE (o.id = COALESCE(v_row.makeup_root, v_row.id) OR o.makeup_root = COALESCE(v_row.makeup_root, v_row.id))
    AND (o.status = 'REJECTED' OR o.id = v_row.id);

  INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
  VALUES (
    v_row.user_id,
    'REVIEW_REJECTED',
    '⚠️ 인증이 점수에서 제외됐어요',
    v_program_name || E'\n' || v_mission_title
      || CASE WHEN v_reason IS NOT NULL THEN E'\n사유: ' || v_reason ELSE '' END
      || CASE WHEN v_rejects >= 3
           THEN E'\n같은 인증이 3번 반려돼 이 날짜 인증은 마감됐어요.'
           ELSE E'\n24시간 안에 다시 올리면 원래 날로 인정돼요.' END,
    NULL,
    'verifications',
    v_row.id
  );

  RETURN v_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.exclude_verification_score(UUID, TEXT) TO authenticated;
