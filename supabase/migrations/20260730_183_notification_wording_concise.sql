-- ============================================================
-- Migration: 183 - 알림 문구 간결화 (댓글·좋아요) — 「간결·내용 먼저」
-- 작성일: 2026-07-30
-- 설명:
--   푸시/인앱 알림 문구를 짧고 스캔하기 좋게 정리. (본인 선택: 간결·내용 먼저)
--     - 댓글/답글  title: '💬 {닉}님의 {댓글|답글}'   body: '{댓글내용} · {맥락}'
--     - 좋아요      title: '❤️ {닉}님의 좋아요'         body: '{맥락}'(그대로)
--   기존은 title 이 '…님이 댓글을 남겼어요'로 길어 iOS 푸시에서 잘렸음.
--   맥락 = 게시글 제목(커뮤니티) 또는 미션 제목(인증). 댓글은 내용을 앞에 둠.
--   교체 함수 4개(로직·link_path·선호체크 전부 동일, title/body 만 변경):
--     notify_on_community_post_comment / notify_on_post_comment /
--     notify_on_community_post_like     / notify_on_post_like
--
-- 하위호환: CREATE OR REPLACE 만. 기존 알림 행(과거)엔 영향 없음(신규 알림부터 적용).
-- 복구: 각 함수를 이전 마이그(120/119/180/072) 정의로 재실행.
-- ============================================================

-- 1) 커뮤니티 게시글 댓글/답글 (원본: 120)
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
    '💬 ' || COALESCE(v_actor_nickname, '(?)') || '님의 ' || v_verb,
    LEFT(NEW.content, 60) || CASE WHEN length(NEW.content) > 60 THEN '…' ELSE '' END || ' · ' || v_label,
    '/programs/' || v_program_id::text || '?tab=community&board=' || v_board_id || '&post=' || NEW.post_id::text || '&c=' || NEW.id::text,
    NEW.user_id,
    'community_post_comments',
    NEW.id
  );

  RETURN NEW;
END;
$$;

-- 2) 인증 피드 댓글/답글 (원본: 119)
CREATE OR REPLACE FUNCTION public.notify_on_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verif_owner UUID;
  v_program_id UUID;
  v_mission_title TEXT;
  v_actor_nickname TEXT;
  v_recipient UUID;
  v_verb TEXT;
BEGIN
  SELECT v.user_id, m.program_id, m.title
  INTO v_verif_owner, v_program_id, v_mission_title
  FROM public.verifications v
  JOIN public.missions m ON m.id = v.mission_id
  WHERE v.id = NEW.verification_id;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO v_recipient FROM public.post_comments WHERE id = NEW.parent_id;
    v_verb := '답글';
  ELSE
    v_recipient := v_verif_owner;
    v_verb := '댓글';
  END IF;

  IF v_recipient IS NULL OR v_recipient = NEW.user_id THEN RETURN NEW; END IF;
  IF NOT public.is_notification_enabled(v_recipient, 'POST_COMMENT') THEN RETURN NEW; END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_recipient,
    'POST_COMMENT',
    '💬 ' || COALESCE(v_actor_nickname, '(?)') || '님의 ' || v_verb,
    LEFT(NEW.content, 60) || CASE WHEN length(NEW.content) > 60 THEN '…' ELSE '' END || ' · ' || v_mission_title,
    '/programs/' || v_program_id::text || '/feed?v=' || NEW.verification_id::text || '&c=' || NEW.id::text,
    NEW.user_id,
    'post_comments',
    NEW.id
  );

  RETURN NEW;
END;
$$;

-- 3) 커뮤니티 게시글 좋아요 (원본: 180) — title 만 변경, body(게시글 제목) 유지
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

  IF v_author_id IS NULL OR v_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_notification_enabled(v_author_id, 'POST_LIKE') THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;
  v_label := COALESCE(NULLIF(btrim(v_title), ''), LEFT(COALESCE(v_body, ''), 20), '게시글');

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_author_id,
    'POST_LIKE',
    '❤️ ' || COALESCE(v_actor_nickname, '(?)') || '님의 좋아요',
    v_label,
    '/programs/' || v_program_id::text || '?tab=community&board=' || v_board_id || '&post=' || NEW.post_id::text,
    NEW.user_id,
    'community_post_likes',
    NEW.id
  );

  RETURN NEW;
END;
$$;

-- 4) 인증 좋아요 (원본: 072) — title 만 변경, body(미션 제목) 유지
CREATE OR REPLACE FUNCTION public.notify_on_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_program_id UUID;
  v_actor_nickname TEXT;
  v_mission_title TEXT;
BEGIN
  SELECT v.user_id, m.program_id, m.title
  INTO v_owner_id, v_program_id, v_mission_title
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
    '❤️ ' || COALESCE(v_actor_nickname, '(?)') || '님의 좋아요',
    v_mission_title,
    '/programs/' || v_program_id::text || '/feed',
    NEW.user_id,
    'post_likes',
    NEW.id
  );

  RETURN NEW;
END;
$$;
