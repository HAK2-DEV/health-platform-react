-- ============================================================
-- Migration: 180 - 커뮤니티(공지) 게시글 좋아요 알림 트리거
-- 작성일: 2026-07-29
-- 설명:
--   community_post_likes INSERT 시 글 작성자에게 좋아요 알림.
--   그동안 인증(post_likes)·공지 댓글(community_post_comments)엔 알림 트리거가 있었으나
--   공지 게시글 「좋아요」만 트리거가 없어 알림이 안 갔음 → 이 트리거로 보강.
--   패턴은 notify_on_post_like(041) + notify_on_community_post_comment(120) 을 그대로 따름:
--     - 본인 글에 본인 좋아요는 알림 X
--     - 수신자 선호(is_notification_enabled, 'POST_LIKE'=like_enabled) 확인
--     - link_path 는 공지 댓글과 동일한 게시글 앵커(단, &c= 없음)
--   타입은 인증 좋아요와 동일 'POST_LIKE' → 「좋아요 알림」 토글로 함께 제어됨.
--
-- 하위호환: 신규 함수/트리거만 추가. 기존 동작 무변경.
-- 복구:
--   DROP TRIGGER IF EXISTS notify_like_on_community_post_likes ON public.community_post_likes;
--   DROP FUNCTION IF EXISTS public.notify_on_community_post_like();
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_on_community_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id UUID;
  v_program_id UUID;
  v_board_id TEXT;
  v_title TEXT;
  v_body TEXT;
  v_label TEXT;
  v_actor_nickname TEXT;
BEGIN
  SELECT cp.author_id, cp.program_id, cp.board_id, cp.title, cp.body
  INTO v_author_id, v_program_id, v_board_id, v_title, v_body
  FROM public.community_posts cp
  WHERE cp.id = NEW.post_id;

  -- 글을 못 찾거나(삭제 등) 본인 글에 본인 좋아요면 알림 X
  IF v_author_id IS NULL OR v_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- 수신자의 「좋아요 알림」 선호 확인
  IF NOT public.is_notification_enabled(v_author_id, 'POST_LIKE') THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;
  v_label := COALESCE(NULLIF(btrim(v_title), ''), LEFT(COALESCE(v_body, ''), 20), '게시글');

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_author_id,
    'POST_LIKE',
    '❤️ ' || COALESCE(v_actor_nickname, '(?)') || '님이 좋아해요',
    v_label,
    '/programs/' || v_program_id::text || '?tab=community&board=' || v_board_id || '&post=' || NEW.post_id::text,
    NEW.user_id,
    'community_post_likes',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_like_on_community_post_likes ON public.community_post_likes;
CREATE TRIGGER notify_like_on_community_post_likes
AFTER INSERT ON public.community_post_likes
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_community_post_like();
