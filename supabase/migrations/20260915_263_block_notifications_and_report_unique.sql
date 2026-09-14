-- ============================================================
-- Migration: 263 - 차단 사용자 알림 서버 차단 + 신고 UNIQUE 에 program_id + 댓글 신고 링크 정정
-- 작성일: 2026-09-15
-- 설명 (262 리뷰에서 나온 결함 3건):
--   1) 차단은 클라 목록에서만 숨겨져 «푸시»로는 그대로 왔다(041/044 알림 트리거 → 178 푸시 트리거).
--      notifications BEFORE INSERT 트리거로 «받는 사람이 보낸 사람을 차단했으면» 행 자체를 만들지 않는다
--      → 목록·벨 배지·웹/FCM 푸시가 서버에서 한 번에 일치. (이미 쌓인 옛 행은 클라가 actor_id 로 거른다)
--   2) reports UNIQUE(target_type, target_id, reporter_id) 에 program_id 가 없어 같은 사용자를 다른
--      프로그램에서 다시 «사용자 신고» 할 수 없었다. (program_id, target_type, target_id, reporter_id) 로 교체.
--      넓히는 방향이라 하위호환.
--   3) 262 의 community_comment 알림 링크 파라미터가 &comment= 였는데 앱은 댓글 포커스에 ?c= 를 쓴다.
--      262 파일도 고쳤지만 프로드에는 1차 버전이 적용돼 있으므로 여기서 함수를 다시 정의한다(262 재실행 불필요).
--
-- 복구:
--   DROP TRIGGER IF EXISTS notifications_skip_blocked ON public.notifications;
--   DROP FUNCTION IF EXISTS public.skip_notification_if_blocked();
--   ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_program_target_reporter_key;
--   ALTER TABLE public.reports ADD CONSTRAINT reports_target_type_target_id_reporter_id_key UNIQUE (target_type, target_id, reporter_id);
-- ============================================================

-- ─── 1) 알림 서버 차단 ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.skip_notification_if_blocked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- actor 가 없는 시스템 알림(승인/반려·신고 접수 등)은 그대로. 보낸 사람이 차단됐으면 행을 만들지 않는다.
  IF NEW.actor_id IS NOT NULL AND NEW.actor_id <> NEW.user_id AND EXISTS (
    SELECT 1 FROM public.blocked_users b WHERE b.blocker_id = NEW.user_id AND b.blocked_id = NEW.actor_id
  ) THEN
    RETURN NULL;   -- BEFORE INSERT 에서 NULL = 이 행 건너뜀 (오류 아님)
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notifications_skip_blocked ON public.notifications;
CREATE TRIGGER notifications_skip_blocked
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.skip_notification_if_blocked();

-- ─── 2) 신고 UNIQUE 에 program_id ──────────────────────────
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_target_type_target_id_reporter_id_key;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_program_target_reporter_key;
ALTER TABLE public.reports ADD CONSTRAINT reports_program_target_reporter_key
  UNIQUE (program_id, target_type, target_id, reporter_id);

-- ─── 3) 신고 접수 알림 — 댓글 링크 파라미터 정정 (&comment= → &c=) ──
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
      || '&post=' || COALESCE(v_pid::text, '') || '&c=' || NEW.target_id::text;
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
