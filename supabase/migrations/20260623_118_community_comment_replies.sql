-- ============================================================
-- Migration: 118 - 커뮤니티 글 댓글 1단계 답글(parent_id)
-- 작성일: 2026-06-23
-- 설명:
--   community_post_comments 에 parent_id 추가 → 댓글에 답글(대댓글) 1단계.
--   · 1단계 강제: BEFORE INSERT 트리거가 parent 가 답글이면 그 최상위 댓글로 평탄화.
--     (답글의 답글도 항상 최상위 댓글에 귀속 → 무한 중첩 방지)
--   · 무결성: parent 가 다른 글이거나 없으면 parent_id := NULL (일반 댓글로).
--   · 알림(107 갱신): 답글이면 '부모 댓글 작성자'에게, 일반 댓글이면 기존대로 '글 작성자'에게.
--     타입은 POST_COMMENT 재사용(아이콘·필터·수신선호 comment_enabled 그대로).
--
--   하위호환: 기존 댓글 parent_id=NULL(최상위). 기존 알림 동작 유지(parent 없을 때 동일).
--
-- 복구:
--   DROP TRIGGER IF EXISTS community_post_comment_flatten ON public.community_post_comments;
--   DROP FUNCTION IF EXISTS public.community_post_comment_flatten_parent();
--   ALTER TABLE public.community_post_comments DROP COLUMN IF EXISTS parent_id;
--   + 107 의 notify_on_community_post_comment() 본문 재실행.
-- ============================================================

-- 1) parent_id 컬럼 + 인덱스
ALTER TABLE public.community_post_comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.community_post_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_cpc_parent ON public.community_post_comments(parent_id);

-- 2) 1단계 평탄화 + 무결성 트리거 (BEFORE INSERT)
CREATE OR REPLACE FUNCTION public.community_post_comment_flatten_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grandparent UUID;
  v_parent_post UUID;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;

  SELECT parent_id, post_id INTO v_grandparent, v_parent_post
  FROM public.community_post_comments WHERE id = NEW.parent_id;

  -- 부모가 없거나(경합 삭제) 다른 글이면 일반 댓글로
  IF NOT FOUND OR v_parent_post IS DISTINCT FROM NEW.post_id THEN
    NEW.parent_id := NULL;
    RETURN NEW;
  END IF;

  -- 부모가 답글이면 최상위로 귀속 (1단계 보장)
  IF v_grandparent IS NOT NULL THEN
    NEW.parent_id := v_grandparent;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_post_comment_flatten ON public.community_post_comments;
CREATE TRIGGER community_post_comment_flatten
  BEFORE INSERT ON public.community_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.community_post_comment_flatten_parent();

-- 3) 알림 — 답글이면 부모 댓글 작성자, 일반 댓글이면 글 작성자
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

  -- 수신자 없음 / 본인 활동이면 알림 X
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
    '/programs/' || v_program_id::text || '?tab=community&board=' || v_board_id || '&post=' || NEW.post_id::text,
    NEW.user_id,
    'community_post_comments',
    NEW.id
  );

  RETURN NEW;
END;
$$;
