-- ============================================================
-- Migration: 110 - 게시글 승인/거절 결과 알림 (작성자에게)
-- 작성일: 2026-06-23
-- 설명:
--   승인 게시판 글의 검토 결과를 작성자에게 알림.
--   · 승인: community_posts UPDATE(status pending→visible) 트리거 → POST_APPROVED 알림.
--           link_path 로 커뮤니티 탭의 해당 글 상세(중앙 카드)를 연다.
--   · 거절: reject_community_post(post_id, reason) RPC — 운영자가 사유 입력 →
--           작성자에게 POST_REJECTED 알림(사유 포함) 후 글 삭제. (운영자만 실행)
--
--   1) type CHECK 에 POST_APPROVED / POST_REJECTED 추가
--   2) is_notification_enabled 매핑(둘 다 verify_enabled — 내 콘텐츠 검토 결과)
--   3) 승인 트리거 (AFTER UPDATE)
--   4) 거절 RPC (SECURITY DEFINER, 사유 알림 + 삭제)
--
-- 영향: 신규 타입/트리거/함수만. 기존 동작 무변경.
--
-- 복구:
--   DROP TRIGGER IF EXISTS community_post_approved_notify ON public.community_posts;
--   DROP FUNCTION IF EXISTS public.notify_on_community_post_approved();
--   DROP FUNCTION IF EXISTS public.reject_community_post(UUID, TEXT);
-- ============================================================

-- 1) type CHECK 확장
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'REVIEW_APPROVED', 'REVIEW_REJECTED', 'POST_LIKE', 'POST_COMMENT',
    'PARTICIPANT_JOINED', 'VERIFICATION_SUBMITTED', 'POST_PENDING',
    'POST_APPROVED', 'POST_REJECTED'
  ));

-- 2) 수신 선호 매핑
CREATE OR REPLACE FUNCTION public.is_notification_enabled(
  p_user_id UUID,
  p_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pref public.notification_preferences;
BEGIN
  SELECT * INTO v_pref FROM public.notification_preferences WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  RETURN CASE p_type
    WHEN 'POST_LIKE'              THEN v_pref.like_enabled
    WHEN 'POST_COMMENT'           THEN v_pref.comment_enabled
    WHEN 'REVIEW_APPROVED'        THEN v_pref.verify_enabled
    WHEN 'REVIEW_REJECTED'        THEN v_pref.verify_enabled
    WHEN 'VERIFICATION_SUBMITTED' THEN v_pref.verify_enabled
    WHEN 'PARTICIPANT_JOINED'     THEN v_pref.request_enabled
    WHEN 'POST_PENDING'           THEN v_pref.request_enabled
    WHEN 'POST_APPROVED'          THEN v_pref.verify_enabled
    WHEN 'POST_REJECTED'          THEN v_pref.verify_enabled
    ELSE TRUE
  END;
END;
$$;

-- 3) 승인 알림 트리거 (pending → visible)
CREATE OR REPLACE FUNCTION public.notify_on_community_post_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program_name TEXT;
  v_label TEXT;
BEGIN
  -- 검토 대기 → 노출로 바뀐 경우에만
  IF NOT (OLD.status = 'pending' AND NEW.status = 'visible') THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_notification_enabled(NEW.author_id, 'POST_APPROVED') THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_program_name FROM public.programs WHERE id = NEW.program_id;
  v_label := COALESCE(NULLIF(btrim(NEW.title), ''), LEFT(COALESCE(NEW.body, ''), 20), '게시글');

  INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
  VALUES (
    NEW.author_id,
    'POST_APPROVED',
    '✅ 게시글이 승인됐어요',
    '“' || v_label || '” 글이 게시됐어요 (' || COALESCE(v_program_name, '') || ')',
    '/programs/' || NEW.program_id::text || '?tab=community&board=' || NEW.board_id || '&post=' || NEW.id::text,
    'community_posts',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_post_approved_notify ON public.community_posts;
CREATE TRIGGER community_post_approved_notify
  AFTER UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_community_post_approved();

-- 4) 거절 RPC — 사유 알림 후 삭제 (운영자만)
CREATE OR REPLACE FUNCTION public.reject_community_post(
  p_post_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id UUID;
  v_program_id UUID;
  v_program_name TEXT;
  v_title TEXT;
  v_body TEXT;
  v_label TEXT;
BEGIN
  SELECT author_id, program_id, title, body
  INTO v_author_id, v_program_id, v_title, v_body
  FROM public.community_posts WHERE id = p_post_id;

  IF v_author_id IS NULL THEN
    RAISE EXCEPTION '게시글을 찾을 수 없어요';
  END IF;
  -- 운영자 검증
  IF NOT EXISTS (SELECT 1 FROM public.programs p WHERE p.id = v_program_id AND p.owner_id = auth.uid()) THEN
    RAISE EXCEPTION '권한이 없어요';
  END IF;

  SELECT name INTO v_program_name FROM public.programs WHERE id = v_program_id;
  v_label := COALESCE(NULLIF(btrim(v_title), ''), LEFT(COALESCE(v_body, ''), 20), '게시글');

  -- 작성자에게 거절 알림 (사유 포함, 선호 존중). 글이 삭제되므로 link_path 없음.
  IF v_author_id <> auth.uid() AND public.is_notification_enabled(v_author_id, 'POST_REJECTED') THEN
    INSERT INTO public.notifications (user_id, type, title, body, ref_table, ref_id)
    VALUES (
      v_author_id,
      'POST_REJECTED',
      '🚫 게시글이 게시되지 않았어요',
      '“' || v_label || '” 글이 게시되지 않았어요.'
        || CASE WHEN btrim(COALESCE(p_reason, '')) <> '' THEN E'\n사유: ' || p_reason ELSE '' END,
      'community_posts',
      p_post_id
    );
  END IF;

  DELETE FROM public.community_posts WHERE id = p_post_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.reject_community_post(UUID, TEXT) TO authenticated;
