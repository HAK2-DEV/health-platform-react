-- ============================================================
-- Migration: 043 - 좋아요/댓글 알림 link_path 에 verification_id 추가
-- 작성일: 2026-05-25
-- 설명: 본인 피드백 — "댓글 알림 클릭 시 피드 최상단으로 가지 말고
--   해당 게시물로 스크롤되게 해줘"
--   해결: link_path 에 ?v={verification_id} 쿼리 파라미터 부착 →
--          ProgramFeedPage 가 useSearchParams 로 읽어서 해당 article 로 scrollIntoView.
--
-- 영향: 041 에서 만든 두 함수만 교체 (CREATE OR REPLACE).
--   트리거 자체는 그대로 (함수 본문만 갱신).
--
-- 복구:
--   supabase/rollbacks/043_revert_notification_link_target.sql 수동 실행.
-- ============================================================

-- ─── 좋아요 알림 (link_path 갱신) ─────────────────────────
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

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_owner_id,
    'POST_LIKE',
    '❤️ ' || COALESCE(v_actor_nickname, '(?)') || '님이 좋아해요',
    v_mission_title,
    '/programs/' || v_program_id::text || '/feed?v=' || NEW.verification_id::text,
    NEW.user_id,
    'post_likes',
    NEW.id
  );

  RETURN NEW;
END;
$$;


-- ─── 댓글 알림 (link_path 갱신) ───────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_post_comment()
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

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_owner_id,
    'POST_COMMENT',
    '💬 ' || COALESCE(v_actor_nickname, '(?)') || '님이 댓글을 남겼어요',
    v_mission_title || ' — ' || LEFT(NEW.content, 60) || CASE WHEN length(NEW.content) > 60 THEN '...' ELSE '' END,
    '/programs/' || v_program_id::text || '/feed?v=' || NEW.verification_id::text,
    NEW.user_id,
    'post_comments',
    NEW.id
  );

  RETURN NEW;
END;
$$;
