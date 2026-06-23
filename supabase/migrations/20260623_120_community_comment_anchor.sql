-- ============================================================
-- Migration: 120 - 커뮤니티 글 댓글 알림에 댓글 앵커(&c=) 추가
-- 작성일: 2026-06-23
-- 설명:
--   커뮤니티 댓글/답글 알림 클릭 시 글 상세는 열리지만 '그 댓글'로 이동·하이라이트가
--   안 됐음. link_path 에 &c=<comment_id> 를 붙여 프론트가 해당 댓글로 스크롤하도록.
--   (인증 피드 댓글 119 의 ?v=&c= 앵커와 동일 취지)
--
--   118 의 notify_on_community_post_comment() 본문에서 link_path 만 &c= 추가.
--   하위호환: c 미지원 구버전 프론트도 글 상세까지는 정상 이동(graceful).
--
-- 복구: 118 의 notify_on_community_post_comment() 본문 재실행.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_on_community_post_comment()
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
  v_recipient UUID;
  v_verb TEXT;
BEGIN
  SELECT cp.author_id, cp.program_id, cp.board_id, cp.title, cp.body
  INTO v_author_id, v_program_id, v_board_id, v_title, v_body
  FROM public.community_posts cp
  WHERE cp.id = NEW.post_id;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO v_recipient FROM public.community_post_comments WHERE id = NEW.parent_id;
    v_verb := '답글';
  ELSE
    v_recipient := v_author_id;
    v_verb := '댓글';
  END IF;

  IF v_recipient IS NULL OR v_recipient = NEW.user_id THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_notification_enabled(v_recipient, 'POST_COMMENT') THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;
  v_label := COALESCE(NULLIF(btrim(v_title), ''), LEFT(COALESCE(v_body, ''), 20), '게시글');

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_recipient,
    'POST_COMMENT',
    '💬 ' || COALESCE(v_actor_nickname, '(?)') || '님이 ' || v_verb || '을 남겼어요',
    v_label || ' — ' || LEFT(NEW.content, 60) || CASE WHEN length(NEW.content) > 60 THEN '...' ELSE '' END,
    '/programs/' || v_program_id::text || '?tab=community&board=' || v_board_id || '&post=' || NEW.post_id::text || '&c=' || NEW.id::text,
    NEW.user_id,
    'community_post_comments',
    NEW.id
  );

  RETURN NEW;
END;
$$;
