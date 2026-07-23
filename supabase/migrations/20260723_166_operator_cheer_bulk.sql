-- ============================================================
-- Migration: 166 - 운영자 응원 일괄 보내기 (Phase 2)
-- 작성일: 2026-07-23
-- 설명:
--   165(개별 응원)에 이어, 운영자가 여러 참여자에게 한 번에 응원을 보내는 RPC.
--   (예: 휴면 참여자 그룹 전체에게 격려)
--   - RPC send_operator_cheer_bulk(program_id, target_user_ids[], message):
--       · 호출자 = 프로그램 운영자(owner) 또는 관리자 검증
--       · 메시지 1~200자
--       · 대상 중 "이 프로그램 ACTIVE 참여자 + 본인 아님 + 오늘(KST) 아직 안 받음"에게만 insert
--         (하루 1회/참여자 남용방지 — 165 와 동일 규칙, 이미 받은 사람은 자동 skip)
--       · 실제 보낸 수(정수) 반환 → 프론트가 "N명에게 보냈어요(M명 오늘 이미 받음)" 표시
--   SECURITY DEFINER. type CHECK/컬럼 변경 없음(165 의 OPERATOR_CHEER 재사용) — 순수 추가.
--
-- 하위호환: 함수 추가만. 165 미적용 상태면 먼저 165 적용 필요(OPERATOR_CHEER 타입).
--
-- 복구:
--   DROP FUNCTION IF EXISTS public.send_operator_cheer_bulk(uuid, uuid[], text);
-- ============================================================

CREATE OR REPLACE FUNCTION public.send_operator_cheer_bulk(
  p_program_id uuid,
  p_target_user_ids uuid[],
  p_message text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_owner  uuid;
  v_msg    text := btrim(coalesce(p_message, ''));
  v_sent   integer := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION '로그인이 필요해요';
  END IF;

  SELECT owner_id INTO v_owner FROM public.programs WHERE id = p_program_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION '프로그램을 찾을 수 없어요';
  END IF;
  IF v_caller <> v_owner AND NOT public.is_admin() THEN
    RAISE EXCEPTION '운영자만 응원을 보낼 수 있어요';
  END IF;

  IF length(v_msg) = 0 THEN
    RAISE EXCEPTION '응원 메시지를 입력해주세요';
  END IF;
  IF length(v_msg) > 200 THEN
    RAISE EXCEPTION '응원 메시지는 200자 이내로 작성해주세요';
  END IF;

  IF p_target_user_ids IS NULL OR array_length(p_target_user_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- 대상: ACTIVE 참여자 + 본인 제외 + 오늘 아직 응원 안 받은 사람에게만
  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id)
  SELECT pp.user_id, 'OPERATOR_CHEER', '💌 운영자 응원이 도착했어요', v_msg,
         '/programs/' || p_program_id::text, v_caller
  FROM public.program_participants pp
  WHERE pp.program_id = p_program_id
    AND pp.status = 'ACTIVE'
    AND pp.user_id = ANY(p_target_user_ids)
    AND pp.user_id <> v_caller
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = pp.user_id
        AND n.type = 'OPERATOR_CHEER'
        AND n.actor_id = v_caller
        AND n.link_path = '/programs/' || p_program_id::text
        AND (n.created_at AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date
    );

  GET DIAGNOSTICS v_sent = ROW_COUNT;
  RETURN v_sent;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_operator_cheer_bulk(uuid, uuid[], text) TO authenticated;
