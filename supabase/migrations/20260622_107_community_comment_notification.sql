-- ============================================================
-- Migration: 107 - 커뮤니티 게시판 댓글 알림
-- 작성일: 2026-06-22
-- 설명:
--   community_post_comments(105) 에 댓글이 달리면 글 작성자(community_posts.author_id)
--   에게 알림. 인증 피드 댓글(post_comments, 044)과 동일하게 POST_COMMENT 타입 재사용 →
--   알림 목록/필터/아이콘(💬 comment)·수신 선호(comment_enabled) 그대로 적용됨.
--
--   link_path: /programs/:id?tab=community&board=<board_id>&post=<post_id>
--     → 프론트가 해당 게시판을 선택하고 그 게시글 상세(댓글 포함) 모달을 자동 오픈.
--     (프론트 미배포 시에도 커뮤니티 탭으로는 정상 이동 — graceful)
--
--   · 본인 글에 본인이 댓글: 알림 X (author_id = NEW.user_id)
--   · 수신 선호 OFF(comment_enabled=false): 알림 X (is_notification_enabled 헬퍼)
--   · SECURITY DEFINER — notifications RLS 우회해 삽입 (042/072 트리거와 동일 패턴)
--
-- 영향: 신규 함수 + community_post_comments AFTER INSERT 트리거만 추가. 기존 동작 무변경.
--
-- 복구:
--   DROP TRIGGER IF EXISTS community_post_comment_notify ON public.community_post_comments;
--   DROP FUNCTION IF EXISTS public.notify_on_community_post_comment();
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
BEGIN
  SELECT cp.author_id, cp.program_id, cp.board_id, cp.title, cp.body
  INTO v_author_id, v_program_id, v_board_id, v_title, v_body
  FROM public.community_posts cp
  WHERE cp.id = NEW.post_id;

  -- 글이 없거나(삭제 경합) 본인 글에 본인 댓글이면 알림 X
  IF v_author_id IS NULL OR v_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- 수신자 선호 (comment_enabled) 존중
  IF NOT public.is_notification_enabled(v_author_id, 'POST_COMMENT') THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;
  -- 본문 라벨 — 제목 있으면 제목, 없으면 본문 앞부분
  v_label := COALESCE(NULLIF(btrim(v_title), ''), LEFT(COALESCE(v_body, ''), 20), '게시글');

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_author_id,
    'POST_COMMENT',
    '💬 ' || COALESCE(v_actor_nickname, '(?)') || '님이 댓글을 남겼어요',
    v_label || ' — ' || LEFT(NEW.content, 60) || CASE WHEN length(NEW.content) > 60 THEN '...' ELSE '' END,
    '/programs/' || v_program_id::text || '?tab=community&board=' || v_board_id || '&post=' || NEW.post_id::text,
    NEW.user_id,
    'community_post_comments',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_post_comment_notify ON public.community_post_comments;
CREATE TRIGGER community_post_comment_notify
  AFTER INSERT ON public.community_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_community_post_comment();
