-- ============================================================
-- Migration: 191 - 알림 문구: 제목 짧게 + 문장은 본문으로 (iOS 제목 1줄 잘림 해소)
-- 작성일: 2026-07-31
-- 설명:
--   186 은 "OO님이 내 게시글에 댓글을 달았어요" 문장을 title 에 넣었는데,
--   iOS 잠금화면 푸시는 title 을 무조건 1줄로 잘라 "…" 로 끊겼다.
--   해결: title 은 짧은 라벨(💬 새 댓글 / 💬 새 답글 / ❤️ 새 좋아요), 문장은 body 로.
--     body 는 여러 줄로 늘어나 안 잘림. 댓글은 body 에 문장 + 댓글 내용(둘째 줄)까지.
--   로직·link_path·선호체크·actor/ref 전부 동일, title/body 만 변경.
--
-- 하위호환: CREATE OR REPLACE 만. 과거 알림 행 무영향(신규 알림부터).
-- 복구: 186 정의로 재실행.
-- ============================================================

-- 1) 커뮤니티 게시글 댓글/답글
CREATE OR REPLACE FUNCTION public.notify_on_community_post_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_author_id UUID;
  v_program_id UUID;
  v_board_id TEXT;
  v_actor_nickname TEXT;
  v_recipient UUID;
  v_action TEXT;
BEGIN
  SELECT cp.author_id, cp.program_id, cp.board_id
  INTO v_author_id, v_program_id, v_board_id
  FROM public.community_posts cp
  WHERE cp.id = NEW.post_id;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO v_recipient FROM public.community_post_comments WHERE id = NEW.parent_id;
    v_action := '내 댓글에 답글을 달았어요';
  ELSE
    v_recipient := v_author_id;
    v_action := '내 게시글에 댓글을 달았어요';
  END IF;

  IF v_recipient IS NULL OR v_recipient = NEW.user_id THEN RETURN NEW; END IF;
  IF NOT public.is_notification_enabled(v_recipient, 'POST_COMMENT') THEN RETURN NEW; END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_recipient,
    'POST_COMMENT',
    '💬 ' || CASE WHEN NEW.parent_id IS NOT NULL THEN '새 답글' ELSE '새 댓글' END,
    COALESCE(v_actor_nickname, '(?)') || '님이 ' || v_action
      || CASE WHEN btrim(COALESCE(NEW.content, '')) <> ''
              THEN E'\n' || LEFT(NEW.content, 60) || CASE WHEN length(NEW.content) > 60 THEN '…' ELSE '' END
              ELSE '' END,
    '/programs/' || v_program_id::text || '?tab=community&board=' || v_board_id || '&post=' || NEW.post_id::text || '&c=' || NEW.id::text,
    NEW.user_id,
    'community_post_comments',
    NEW.id
  );

  RETURN NEW;
END;
$$;

-- 2) 인증 피드 댓글/답글
CREATE OR REPLACE FUNCTION public.notify_on_post_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_verif_owner UUID;
  v_program_id UUID;
  v_actor_nickname TEXT;
  v_recipient UUID;
  v_action TEXT;
BEGIN
  SELECT v.user_id, m.program_id
  INTO v_verif_owner, v_program_id
  FROM public.verifications v
  JOIN public.missions m ON m.id = v.mission_id
  WHERE v.id = NEW.verification_id;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO v_recipient FROM public.post_comments WHERE id = NEW.parent_id;
    v_action := '내 댓글에 답글을 달았어요';
  ELSE
    v_recipient := v_verif_owner;
    v_action := '내 인증글에 댓글을 달았어요';
  END IF;

  IF v_recipient IS NULL OR v_recipient = NEW.user_id THEN RETURN NEW; END IF;
  IF NOT public.is_notification_enabled(v_recipient, 'POST_COMMENT') THEN RETURN NEW; END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_recipient,
    'POST_COMMENT',
    '💬 ' || CASE WHEN NEW.parent_id IS NOT NULL THEN '새 답글' ELSE '새 댓글' END,
    COALESCE(v_actor_nickname, '(?)') || '님이 ' || v_action
      || CASE WHEN btrim(COALESCE(NEW.content, '')) <> ''
              THEN E'\n' || LEFT(NEW.content, 60) || CASE WHEN length(NEW.content) > 60 THEN '…' ELSE '' END
              ELSE '' END,
    '/programs/' || v_program_id::text || '/feed?v=' || NEW.verification_id::text || '&c=' || NEW.id::text,
    NEW.user_id,
    'post_comments',
    NEW.id
  );

  RETURN NEW;
END;
$$;

-- 3) 커뮤니티 게시글 좋아요
CREATE OR REPLACE FUNCTION public.notify_on_community_post_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_author_id UUID;
  v_program_id UUID;
  v_board_id TEXT;
  v_actor_nickname TEXT;
BEGIN
  SELECT cp.author_id, cp.program_id, cp.board_id
  INTO v_author_id, v_program_id, v_board_id
  FROM public.community_posts cp
  WHERE cp.id = NEW.post_id;

  IF v_author_id IS NULL OR v_author_id = NEW.user_id THEN RETURN NEW; END IF;
  IF NOT public.is_notification_enabled(v_author_id, 'POST_LIKE') THEN RETURN NEW; END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_author_id,
    'POST_LIKE',
    '❤️ 새 좋아요',
    COALESCE(v_actor_nickname, '(?)') || '님이 내 게시글에 좋아요를 눌렀어요',
    '/programs/' || v_program_id::text || '?tab=community&board=' || v_board_id || '&post=' || NEW.post_id::text,
    NEW.user_id,
    'community_post_likes',
    NEW.id
  );

  RETURN NEW;
END;
$$;

-- 4) 인증 좋아요
CREATE OR REPLACE FUNCTION public.notify_on_post_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner_id UUID;
  v_program_id UUID;
  v_actor_nickname TEXT;
BEGIN
  SELECT v.user_id, m.program_id
  INTO v_owner_id, v_program_id
  FROM public.verifications v
  JOIN public.missions m ON m.id = v.mission_id
  WHERE v.id = NEW.verification_id;

  IF v_owner_id = NEW.user_id THEN RETURN NEW; END IF;
  IF NOT public.is_notification_enabled(v_owner_id, 'POST_LIKE') THEN RETURN NEW; END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_owner_id,
    'POST_LIKE',
    '❤️ 새 좋아요',
    COALESCE(v_actor_nickname, '(?)') || '님이 내 인증글에 좋아요를 눌렀어요',
    '/programs/' || v_program_id::text || '/feed',
    NEW.user_id,
    'post_likes',
    NEW.id
  );

  RETURN NEW;
END;
$$;
