-- ============================================================
-- Migration: 167 - 응원/환영 RPC 에 제목 파라미터 추가
-- 작성일: 2026-07-23
-- 설명:
--   운영자 메시지를 "응원"과 "환영"으로 구분해 알림 제목을 다르게 보이게.
--   send_operator_cheer / send_operator_cheer_bulk 에 p_title(기본=응원) 추가.
--   - 신규 참여자에겐 "👋 운영자 환영 메시지" 로 전달 가능.
--   - 기존 3/3-arg 호출은 p_title 기본값으로 그대로 동작(하위호환). 배포 순서 무관.
--
-- 복구:
--   DROP FUNCTION IF EXISTS public.send_operator_cheer(uuid, uuid, text, text);
--   DROP FUNCTION IF EXISTS public.send_operator_cheer_bulk(uuid, uuid[], text, text);
--   그다음 165/166 의 원본 함수를 다시 적용.
-- ============================================================

-- 기존 시그니처 제거(제목 파라미터 버전으로 대체)
DROP FUNCTION IF EXISTS public.send_operator_cheer(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.send_operator_cheer_bulk(uuid, uuid[], text);

-- ─── 개별 ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_operator_cheer(
  p_program_id uuid,
  p_target_user_id uuid,
  p_message text,
  p_title text DEFAULT '💌 운영자 응원이 도착했어요'
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
  v_title  text := coalesce(nullif(btrim(p_title), ''), '💌 운영자 응원이 도착했어요');
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION '로그인이 필요해요'; END IF;
  SELECT owner_id INTO v_owner FROM public.programs WHERE id = p_program_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION '프로그램을 찾을 수 없어요'; END IF;
  IF v_caller <> v_owner AND NOT public.is_admin() THEN RAISE EXCEPTION '운영자만 보낼 수 있어요'; END IF;
  IF p_target_user_id = v_caller THEN RAISE EXCEPTION '본인에게는 보낼 수 없어요'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.program_participants
    WHERE program_id = p_program_id AND user_id = p_target_user_id AND status = 'ACTIVE'
  ) THEN RAISE EXCEPTION '참여 중인 참여자에게만 보낼 수 있어요'; END IF;
  IF length(v_msg) = 0 THEN RAISE EXCEPTION '메시지를 입력해주세요'; END IF;
  IF length(v_msg) > 200 THEN RAISE EXCEPTION '메시지는 200자 이내로 작성해주세요'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = p_target_user_id AND type = 'OPERATOR_CHEER' AND actor_id = v_caller
      AND link_path = '/programs/' || p_program_id::text
      AND (created_at AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date
  ) THEN RAISE EXCEPTION '오늘은 이미 이 참여자에게 메시지를 보냈어요'; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id)
  VALUES (p_target_user_id, 'OPERATOR_CHEER', v_title, v_msg, '/programs/' || p_program_id::text, v_caller);
END;
$$;
GRANT EXECUTE ON FUNCTION public.send_operator_cheer(uuid, uuid, text, text) TO authenticated;

-- ─── 일괄 ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_operator_cheer_bulk(
  p_program_id uuid,
  p_target_user_ids uuid[],
  p_message text,
  p_title text DEFAULT '💌 운영자 응원이 도착했어요'
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
  v_title  text := coalesce(nullif(btrim(p_title), ''), '💌 운영자 응원이 도착했어요');
  v_sent   integer := 0;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION '로그인이 필요해요'; END IF;
  SELECT owner_id INTO v_owner FROM public.programs WHERE id = p_program_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION '프로그램을 찾을 수 없어요'; END IF;
  IF v_caller <> v_owner AND NOT public.is_admin() THEN RAISE EXCEPTION '운영자만 보낼 수 있어요'; END IF;
  IF length(v_msg) = 0 THEN RAISE EXCEPTION '메시지를 입력해주세요'; END IF;
  IF length(v_msg) > 200 THEN RAISE EXCEPTION '메시지는 200자 이내로 작성해주세요'; END IF;
  IF p_target_user_ids IS NULL OR array_length(p_target_user_ids, 1) IS NULL THEN RETURN 0; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id)
  SELECT pp.user_id, 'OPERATOR_CHEER', v_title, v_msg, '/programs/' || p_program_id::text, v_caller
  FROM public.program_participants pp
  WHERE pp.program_id = p_program_id
    AND pp.status = 'ACTIVE'
    AND pp.user_id = ANY(p_target_user_ids)
    AND pp.user_id <> v_caller
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = pp.user_id AND n.type = 'OPERATOR_CHEER' AND n.actor_id = v_caller
        AND n.link_path = '/programs/' || p_program_id::text
        AND (n.created_at AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date
    );
  GET DIAGNOSTICS v_sent = ROW_COUNT;
  RETURN v_sent;
END;
$$;
GRANT EXECUTE ON FUNCTION public.send_operator_cheer_bulk(uuid, uuid[], text, text) TO authenticated;
