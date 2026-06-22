-- ============================================================
-- Migration: 112 - 인증 거절/점수제외 알림 사유를 또렷하게 (줄바꿈)
-- 작성일: 2026-06-23
-- 설명:
--   기존: 본문이 "미션제목 — 사유 (프로그램명)" 로 사유가 인라인에 묻혀,
--         알림 카드/상세에서 잘 안 보였음.
--   개선: 사유를 "미션제목 (프로그램명)\n사유: ..." 로 줄바꿈 →
--         알림 상세 모달(whitespace-pre-line)에서 또렷하게 보임.
--   대상:
--     · notify_on_verification_review (072) — REJECTED 본문만 (APPROVED 유지)
--     · exclude_verification_score (080) — 점수 제외 알림 본문
--
--   본문 문구만 변경. 동작/트리거/권한 동일.
--
-- 복구: 072 / 080 의 함수 블록 재실행.
-- ============================================================

-- 1) 심사 반려 알림 — 사유 줄바꿈
CREATE OR REPLACE FUNCTION public.notify_on_verification_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission_title TEXT;
  v_program_id UUID;
  v_program_name TEXT;
  v_point INT;
  v_type TEXT;
BEGIN
  IF OLD.status != 'PENDING_REVIEW' THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('APPROVED', 'REJECTED') THEN RETURN NEW; END IF;

  v_type := CASE NEW.status WHEN 'APPROVED' THEN 'REVIEW_APPROVED' ELSE 'REVIEW_REJECTED' END;
  IF NOT public.is_notification_enabled(NEW.user_id, v_type) THEN RETURN NEW; END IF;

  SELECT m.title, m.program_id, m.point, p.name
  INTO v_mission_title, v_program_id, v_point, v_program_name
  FROM public.missions m
  JOIN public.programs p ON p.id = m.program_id
  WHERE m.id = NEW.mission_id;

  IF NEW.status = 'APPROVED' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
    VALUES (
      NEW.user_id,
      'REVIEW_APPROVED',
      '✅ 인증이 승인됐어요',
      v_mission_title || ' — +' || v_point || 'P 획득 (' || v_program_name || ')',
      '/programs/' || v_program_id::text,
      'verifications',
      NEW.id
    );
  ELSIF NEW.status = 'REJECTED' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
    VALUES (
      NEW.user_id,
      'REVIEW_REJECTED',
      '❌ 인증이 반려됐어요',
      v_mission_title || ' (' || v_program_name || ')'
        || CASE WHEN btrim(COALESCE(NEW.rejection_reason, '')) <> '' THEN E'\n사유: ' || NEW.rejection_reason ELSE '' END,
      '/programs/' || v_program_id::text,
      'verifications',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 2) 점수 제외 알림 — 사유 줄바꿈 (RPC 본문만 교체)
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
    v_mission_title || ' (' || v_program_name || ')'
      || CASE WHEN v_reason IS NOT NULL THEN E'\n사유: ' || v_reason ELSE '' END,
    NULL,
    'verifications',
    v_row.id
  );

  RETURN v_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.exclude_verification_score(UUID, TEXT) TO authenticated;
