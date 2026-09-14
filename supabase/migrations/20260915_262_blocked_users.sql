-- ============================================================
-- Migration: 262 - 사용자 차단(blocked_users) + 운영자 응원 차단 반영 + 신고 대상에 댓글·사용자 추가
-- 작성일: 2026-09-15
-- 설명:
--   Google Play UGC 정책: 1:1 상호작용(태그·멘션·메시지 등)이 있는 앱은 «인앱 사용자 차단» 기능과
--   «UGC 및 사용자» 신고 시스템이 필수. 도담의 1순위 근거는 운영자→개인 응원(수신 거부 불가한 1:1 알림, 165).
--
--   1) blocked_users — 내가 차단한 사용자. RLS 로 본인 행만 읽고·쓰고·지운다.
--      화면 필터(게시글·댓글·인증 피드·알림)는 클라이언트가 이 목록을 받아 적용한다(lib/blocks.js).
--      RLS 로 모든 SELECT 를 거르지 않는 이유: 정책 8곳 이상을 건드려야 하고, 실사용 중(112명)인
--      기존 정책 회귀 위험이 크다. 서버가 «반드시» 막아야 하는 것은 1:1 인 응원뿐이라 그것만 RPC 에서 막는다.
--   2) send_operator_cheer / _bulk — 대상이 보낸 사람을 차단했으면 거부(단일) / 제외(일괄). 167 시그니처 유지.
--   3) reports.target_type 에 'comment'(post_comments) · 'community_comment'(community_post_comments) · 'user' 추가.
--      자동 가림(report_auto_hide)은 post/verification 분기만 있어 새 타입엔 아무 일도 안 함(의도).
--      운영자 알림(notify_on_report_received)은 새 타입 라벨·링크를 처리하도록 교체.
--
--   하위호환: 테이블 추가 + CHECK 확장(넓히는 방향) + 함수 교체(기존 호출 시그니처 동일). 기존 코드 영향 없음.
--
--   ⚠️ 이 파일은 «멱등»이라 다시 실행해도 안전하다(IF NOT EXISTS / DROP POLICY IF EXISTS / CREATE OR REPLACE).
--     2026-09-15 1차 적용 후 community_comment 알림 링크 파라미터(&comment= → &c=)를 고쳤으므로 «한 번 더» 실행할 것.
--
-- 복구:
--   DROP TABLE IF EXISTS public.blocked_users;
--   ALTER TABLE public.reports DROP CONSTRAINT reports_target_type_check;
--   ALTER TABLE public.reports ADD CONSTRAINT reports_target_type_check CHECK (target_type IN ('post','verification'));
--   응원 RPC·신고 알림 함수는 167·115 파일의 정의로 되돌린다.
-- ============================================================

-- ─── 1) blocked_users ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
COMMENT ON TABLE public.blocked_users IS '사용자 차단 — blocker 가 blocked 의 게시글·댓글·인증·응원을 보지 않음(클라 필터) + 응원 RPC 서버 거부.';
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blocked_users select own" ON public.blocked_users;
CREATE POLICY "blocked_users select own" ON public.blocked_users
  FOR SELECT TO authenticated USING (blocker_id = auth.uid());
DROP POLICY IF EXISTS "blocked_users insert own" ON public.blocked_users;
CREATE POLICY "blocked_users insert own" ON public.blocked_users
  FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
DROP POLICY IF EXISTS "blocked_users delete own" ON public.blocked_users;
CREATE POLICY "blocked_users delete own" ON public.blocked_users
  FOR DELETE TO authenticated USING (blocker_id = auth.uid());

-- ─── 2) 운영자 응원 — 차단 반영 (167 시그니처 그대로) ─────────
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
  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id)
  VALUES (p_target_user_id, 'OPERATOR_CHEER', v_title, v_msg, '/programs/' || p_program_id::text, v_caller);
END;
$$;
GRANT EXECUTE ON FUNCTION public.send_operator_cheer(uuid, uuid, text, text) TO authenticated;

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
GRANT EXECUTE ON FUNCTION public.send_operator_cheer_bulk(uuid, uuid[], text, text) TO authenticated;

-- ─── 3) 신고 대상 확장: 댓글(2종)·사용자 ────────────────────
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('post', 'verification', 'comment', 'community_comment', 'user'));

-- 운영자 알림 — 새 타입의 라벨·링크·ref_table. post/verification 동작은 115 와 동일.
CREATE OR REPLACE FUNCTION public.notify_on_report_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_program_name TEXT;
  v_label TEXT;
  v_board_id TEXT;
  v_kind TEXT;
  v_link TEXT;
  v_ref_table TEXT;
  v_vid UUID;
  v_pid UUID;
BEGIN
  SELECT owner_id, name INTO v_owner_id, v_program_name
  FROM public.programs WHERE id = NEW.program_id;
  IF v_owner_id IS NULL OR v_owner_id = NEW.reporter_id THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_notification_enabled(v_owner_id, 'REPORT_RECEIVED') THEN
    RETURN NEW;
  END IF;

  IF NEW.target_type = 'post' THEN
    SELECT COALESCE(NULLIF(btrim(title), ''), LEFT(COALESCE(body, ''), 20), '게시글'), board_id
    INTO v_label, v_board_id
    FROM public.community_posts WHERE id = NEW.target_id;
    v_kind := '게시글'; v_ref_table := 'community_posts';
    v_link := '/programs/' || NEW.program_id::text
      || '?tab=community&board=' || COALESCE(v_board_id, 'all')
      || '&post=' || NEW.target_id::text;
  ELSIF NEW.target_type = 'verification' THEN
    SELECT m.title INTO v_label
    FROM public.verifications ver JOIN public.missions m ON m.id = ver.mission_id
    WHERE ver.id = NEW.target_id;
    v_kind := '인증'; v_ref_table := 'verifications';
    v_link := '/programs/' || NEW.program_id::text || '/feed?v=' || NEW.target_id::text;
  ELSIF NEW.target_type = 'comment' THEN
    SELECT LEFT(COALESCE(content, ''), 20), verification_id INTO v_label, v_vid
    FROM public.post_comments WHERE id = NEW.target_id;
    v_kind := '댓글'; v_ref_table := 'post_comments';
    v_link := '/programs/' || NEW.program_id::text || '/feed?v=' || COALESCE(v_vid::text, '') || '&c=' || NEW.target_id::text;
  ELSIF NEW.target_type = 'community_comment' THEN
    SELECT LEFT(COALESCE(c.content, ''), 20), c.post_id, p.board_id INTO v_label, v_pid, v_board_id
    FROM public.community_post_comments c JOIN public.community_posts p ON p.id = c.post_id
    WHERE c.id = NEW.target_id;
    v_kind := '댓글'; v_ref_table := 'community_post_comments';
    v_link := '/programs/' || NEW.program_id::text
      || '?tab=community&board=' || COALESCE(v_board_id, 'all')
      || '&post=' || COALESCE(v_pid::text, '') || '&c=' || NEW.target_id::text;   -- 댓글 포커스 파라미터는 앱 전체가 ?c= 사용(ProgramDetailPage focusCommentId)
  ELSE  -- 'user'
    SELECT nickname INTO v_label FROM public.users WHERE id = NEW.target_id;
    v_kind := '사용자'; v_ref_table := 'users';
    v_link := '/programs/' || NEW.program_id::text;
  END IF;
  v_label := COALESCE(v_label, v_kind);

  INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
  VALUES (
    v_owner_id,
    'REPORT_RECEIVED',
    '🚩 신고가 접수됐어요',
    v_kind || ' “' || v_label || '”에 대한 신고가 접수됐어요 (' || COALESCE(v_program_name, '') || ')',
    v_link,
    v_ref_table,
    NEW.target_id
  );
  RETURN NEW;
END;
$$;
