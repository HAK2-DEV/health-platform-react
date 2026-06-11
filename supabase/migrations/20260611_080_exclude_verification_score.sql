-- ============================================================
-- Migration: 080 - 운영자 사후 점수 제외 (자동승인 어뷰징 대응)
-- 작성일: 2026-06-11
-- 설명: AUTO 미션은 즉시 APPROVED 되어 점수가 들어가므로, 부적절한 인증(예: 운동과
--   무관한 사진)을 운영자가 사후에 점수에서 제외할 수 있게 한다.
--
-- 동작:
--   - 프로그램 운영자만 호출 가능 (대상 인증의 미션이 속한 프로그램 owner)
--   - score_ledgers 에서 해당 인증의 점수 행 삭제 → 랭킹에서 즉시 회수
--   - verifications.status='REJECTED' + 사유 기록 (기록·사진은 보존, 피드에선 제외)
--   - 참가자에게 알림 발송
--
-- 알림 주의:
--   기존 notify_on_verification_review 트리거는 OLD.status='PENDING_REVIEW' 일 때만
--   발화 → AUTO(APPROVED→REJECTED) 전환엔 안 울림. 그래서 여기서 직접 알림 INSERT.
--   점수 트리거 grant_score_on_approval 도 NEW.status='APPROVED' 일 때만 → 안전.
--
-- 되돌리기: 베타에선 UI 미제공. 필요 시 운영자가 재승인(별도)으로 복구.
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

  -- 대상 인증 + 프로그램 소유자 확인
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

  -- 1) 점수 회수 (랭킹 즉시 반영)
  DELETE FROM public.score_ledgers WHERE verification_id = p_verification_id;

  -- 2) 인증을 반려 처리 — 기록·사진은 남기고 피드에서만 빠짐
  UPDATE public.verifications
  SET status = 'REJECTED',
      rejection_reason = v_reason,
      reviewed_at = NOW(),
      reviewer_id = auth.uid()
  WHERE id = p_verification_id
  RETURNING * INTO v_row;

  -- 3) 참가자 알림 (기존 review 트리거가 안 울리는 경로라 수동 발송)
  INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
  VALUES (
    v_row.user_id,
    'REVIEW_REJECTED',
    '⚠️ 인증이 점수에서 제외됐어요',
    v_mission_title || COALESCE(' — ' || v_reason, '') || ' (' || v_program_name || ')',
    '/programs/' || v_program_id::text,
    'verifications',
    v_row.id
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exclude_verification_score(UUID, TEXT) TO authenticated;
