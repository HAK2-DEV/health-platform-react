-- ============================================================
-- Rollback: 275 - 좋아요 알림 ref_id 를 마이그 191 시점으로 되돌린다
-- 작성일: 2026-09-23
--
-- ⚠️ 되돌아가면 좋아요 연타 중복 알림이 «다시» 발생한다(BUG_LOG 17).
-- ⚠️ 275 가 지운 중복 알림(44건)은 이 스크립트로 복구되지 않는다 — 트리거만 원복한다.
-- ============================================================

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
