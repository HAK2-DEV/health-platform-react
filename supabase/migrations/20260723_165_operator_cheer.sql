-- ============================================================
-- Migration: 165 - 운영자 응원 보내기 (OPERATOR_CHEER)
-- 작성일: 2026-07-23
-- 설명:
--   운영자가 참여자에게 격려 알림을 직접 보내는 기능(Phase 1 — 개별 1명).
--   - notifications.type CHECK 에 'OPERATOR_CHEER' 추가 (기존 타입 전부 유지 + 1개 추가)
--   - RPC send_operator_cheer(program_id, target_user_id, message):
--       · 호출자가 프로그램 운영자(owner) 또는 관리자인지 검증
--       · 대상이 해당 프로그램 ACTIVE 참여자인지 검증 (본인 제외)
--       · 메시지 1~200자
--       · 남용방지: 같은 (운영자→참여자, 프로그램) 하루 1회(KST)
--       · notifications insert (actor_id=운영자, link_path=/programs/:id)
--   SECURITY DEFINER — 클라이언트는 남의 알림을 직접 insert 못 하므로(RLS) 검증 포함 RPC 로 처리.
--   ※ 알림 수신설정(is_notification_enabled) 은 적용하지 않음 — 운영자의 1:1 직접 격려라 항상 전달.
--
-- 하위호환: 컬럼/트리거 변경 없음. 기존 알림/타입 그대로 동작. 프론트는 이 마이그 적용 후 배포.
--
-- 복구:
--   DROP FUNCTION IF EXISTS public.send_operator_cheer(uuid, uuid, text);
--   -- OPERATOR_CHEER 알림행 정리 후 CHECK 되돌리려면:
--   --   DELETE FROM public.notifications WHERE type = 'OPERATOR_CHEER';
--   --   그다음 아래 CHECK 에서 'OPERATOR_CHEER' 제거해 재적용.
-- ============================================================

-- ─── 1) type CHECK 확장 (기존 전부 유지 + OPERATOR_CHEER 추가) ──
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'REVIEW_APPROVED', 'REVIEW_REJECTED', 'POST_LIKE', 'POST_COMMENT',
    'PARTICIPANT_JOINED', 'VERIFICATION_SUBMITTED', 'POST_PENDING',
    'POST_APPROVED', 'POST_REJECTED', 'REPORT_RECEIVED',
    'TEAM_INVITE', 'TEAM_JOINED', 'TEAM_REMOVED', 'TEAM_LEADER_CHANGED',
    'INQUIRY_RECEIVED', 'INQUIRY_ANSWERED',
    'OPERATOR_CHEER'
  ));

-- ─── 2) RPC: 운영자 → 참여자 응원 ───────────────────────────
CREATE OR REPLACE FUNCTION public.send_operator_cheer(
  p_program_id uuid,
  p_target_user_id uuid,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_owner  uuid;
  v_msg    text := btrim(coalesce(p_message, ''));
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION '로그인이 필요해요';
  END IF;

  -- 프로그램 + 운영자 확인
  SELECT owner_id INTO v_owner FROM public.programs WHERE id = p_program_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION '프로그램을 찾을 수 없어요';
  END IF;
  IF v_caller <> v_owner AND NOT public.is_admin() THEN
    RAISE EXCEPTION '운영자만 응원을 보낼 수 있어요';
  END IF;

  -- 본인에게는 못 보냄
  IF p_target_user_id = v_caller THEN
    RAISE EXCEPTION '본인에게는 보낼 수 없어요';
  END IF;

  -- 대상이 이 프로그램의 활성 참여자인지
  IF NOT EXISTS (
    SELECT 1 FROM public.program_participants
    WHERE program_id = p_program_id
      AND user_id = p_target_user_id
      AND status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION '참여 중인 참여자에게만 보낼 수 있어요';
  END IF;

  -- 메시지 검증
  IF length(v_msg) = 0 THEN
    RAISE EXCEPTION '응원 메시지를 입력해주세요';
  END IF;
  IF length(v_msg) > 200 THEN
    RAISE EXCEPTION '응원 메시지는 200자 이내로 작성해주세요';
  END IF;

  -- 남용방지: 같은 운영자→참여자, 이 프로그램, 오늘(KST) 이미 보냈으면 거부
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = p_target_user_id
      AND type = 'OPERATOR_CHEER'
      AND actor_id = v_caller
      AND link_path = '/programs/' || p_program_id::text
      AND (created_at AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date
  ) THEN
    RAISE EXCEPTION '오늘은 이미 이 참여자에게 응원을 보냈어요';
  END IF;

  -- 알림 생성
  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id)
  VALUES (
    p_target_user_id,
    'OPERATOR_CHEER',
    '💌 운영자 응원이 도착했어요',
    v_msg,
    '/programs/' || p_program_id::text,
    v_caller
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_operator_cheer(uuid, uuid, text) TO authenticated;
