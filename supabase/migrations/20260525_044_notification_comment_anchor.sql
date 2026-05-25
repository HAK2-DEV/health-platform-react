-- ============================================================
-- Migration: 044 - 댓글 알림 link_path 에 comment_id 추가
-- 작성일: 2026-05-25
-- 설명: 본인 피드백 — "댓글 알림 클릭해도 댓글이 화면 중앙에 안 오고
--   최신 댓글부터 보임 (= 게시물 윗부분만 보임)"
--   원인: 043 은 ?v={verification_id} 까지만 부착 → 피드는 게시물(article) 단위로 스크롤.
--         게시물은 사진+소감+댓글 합쳐서 세로가 길어 정작 댓글은 화면 밖.
--   해결: 댓글 알림은 ?v=...&c={comment_id} 까지 부착 →
--          피드가 c 가 있으면 해당 댓글 노드로 직접 scrollIntoView (block: 'center').
--          (좋아요 알림은 v 만 — 좋아요는 게시물 자체가 타겟이라 충분)
--
-- 영향: 041 의 notify_on_post_comment 함수만 교체.
--   POST_LIKE 는 그대로 (043 상태 유지).
--
-- 복구:
--   supabase/rollbacks/044_revert_notification_comment_anchor.sql 수동 실행.
-- ============================================================

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
    '/programs/' || v_program_id::text || '/feed?v=' || NEW.verification_id::text || '&c=' || NEW.id::text,
    NEW.user_id,
    'post_comments',
    NEW.id
  );

  RETURN NEW;
END;
$$;
