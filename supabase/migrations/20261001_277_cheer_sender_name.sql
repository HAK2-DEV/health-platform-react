-- ============================================================
-- Migration: 277 - 운영자 메시지 알림에 «누가 보냈는지» 표시
-- 작성일: 2026-10-01
-- 설명:
--   send_operator_cheer / send_operator_cheer_bulk 의 알림이 제목 「💌 운영자 응원이
--   도착했어요」·「🌱 다시 함께해요」처럼 «운영자» 라는 일반명사로만 나가, 참여자가
--   어느 프로그램의 누가 보냈는지 알 수 없었다. 브랜드 퍼소나 4-7(docs/BRAND_PERSONA.md,
--   2026-10-01 확정): «이탈 격려는 운영자 이름으로» — 도담이 아니라 운영자가 말한다.
--
--   바뀌는 것 (푸시도 같은 title/body 를 쓰므로 함께 바뀜 — 178 트리거):
--     title = 프로그램 이름 (20자 넘으면 19자 + …)        예) 「3km 챌린지」
--     body  = 운영자 닉네임 || ': ' || 메시지               예) 「정민 코치: 오랜만이에요」
--   닉네임이 비어 있으면 '운영자', 프로그램 이름이 비어 있으면 '도담'.
--
--   p_title 파라미터는 시그니처 호환을 위해 남기되 제목에는 쓰지 않는다
--   (응원·환영·리마인드·복귀 구분은 메시지 본문이 이미 말한다). 기존 클라가 p_title 을
--   보내도 그대로 동작한다 → 프로드 먼저 적용해도 안전, 클라 변경 불필요.
--   권한·대상 검사·262 차단 검사·하루 1회 중복 방지·200자 제한은 그대로.
--
-- 복구: supabase/rollbacks/277_revert_cheer_sender_name.sql (적용 직전 프로드 정의 그대로)
-- ============================================================

CREATE OR REPLACE FUNCTION public._operator_cheer_sender(p_program_id uuid, p_caller uuid)
RETURNS TABLE (title text, sender text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE WHEN char_length(coalesce(nullif(btrim(p.name), ''), '도담')) > 20
         THEN left(btrim(p.name), 19) || '…'
         ELSE coalesce(nullif(btrim(p.name), ''), '도담') END,
    coalesce(nullif(btrim(u.nickname), ''), '운영자')
  FROM public.programs p
  LEFT JOIN public.users u ON u.id = p_caller
  WHERE p.id = p_program_id;
$$;

-- 보조 함수는 두 RPC 안에서만 쓴다 — 익명·일반 사용자 직접 호출 차단
-- (REVOKE FROM PUBLIC 만으로는 anon 이 막히지 않는다: 269 교훈)
REVOKE ALL ON FUNCTION public._operator_cheer_sender(uuid, uuid) FROM PUBLIC, anon, authenticated;

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
  v_title  text;
  v_sender text;
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
  -- 262: 대상이 나(운영자)를 차단했으면 보낼 수 없다 — 1:1 알림은 수신 거부가 없어 서버에서 막는다.
  IF EXISTS (
    SELECT 1 FROM public.blocked_users WHERE blocker_id = p_target_user_id AND blocked_id = v_caller
  ) THEN RAISE EXCEPTION '이 참여자에게는 메시지를 보낼 수 없어요'; END IF;
  IF length(v_msg) = 0 THEN RAISE EXCEPTION '메시지를 입력해주세요'; END IF;
  IF length(v_msg) > 200 THEN RAISE EXCEPTION '메시지는 200자 이내로 작성해주세요'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = p_target_user_id AND type = 'OPERATOR_CHEER' AND actor_id = v_caller
      AND link_path = '/programs/' || p_program_id::text
      AND (created_at AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date
  ) THEN RAISE EXCEPTION '오늘은 이미 이 참여자에게 메시지를 보냈어요'; END IF;

  -- 277: 제목=프로그램 이름, 본문=«닉네임: 메시지»
  SELECT s.title, s.sender INTO v_title, v_sender
  FROM public._operator_cheer_sender(p_program_id, v_caller) s;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id)
  VALUES (p_target_user_id, 'OPERATOR_CHEER', v_title, v_sender || ': ' || v_msg,
          '/programs/' || p_program_id::text, v_caller);
END;
$$;

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
  v_title  text;
  v_sender text;
  v_sent   integer := 0;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION '로그인이 필요해요'; END IF;
  SELECT owner_id INTO v_owner FROM public.programs WHERE id = p_program_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION '프로그램을 찾을 수 없어요'; END IF;
  IF v_caller <> v_owner AND NOT public.is_admin() THEN RAISE EXCEPTION '운영자만 보낼 수 있어요'; END IF;
  IF length(v_msg) = 0 THEN RAISE EXCEPTION '메시지를 입력해주세요'; END IF;
  IF length(v_msg) > 200 THEN RAISE EXCEPTION '메시지는 200자 이내로 작성해주세요'; END IF;
  IF p_target_user_ids IS NULL OR array_length(p_target_user_ids, 1) IS NULL THEN RETURN 0; END IF;

  -- 277: 제목=프로그램 이름, 본문=«닉네임: 메시지»
  SELECT s.title, s.sender INTO v_title, v_sender
  FROM public._operator_cheer_sender(p_program_id, v_caller) s;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id)
  SELECT pp.user_id, 'OPERATOR_CHEER', v_title, v_sender || ': ' || v_msg,
         '/programs/' || p_program_id::text, v_caller
  FROM public.program_participants pp
  WHERE pp.program_id = p_program_id
    AND pp.status = 'ACTIVE'
    AND pp.user_id = ANY(p_target_user_ids)
    AND pp.user_id <> v_caller
    -- 262: 나를 차단한 참여자는 조용히 제외
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b WHERE b.blocker_id = pp.user_id AND b.blocked_id = v_caller
    )
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
