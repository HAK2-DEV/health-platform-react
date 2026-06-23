-- ============================================================
-- Migration: 119 - 인증 피드 댓글 1단계 답글(parent_id)
-- 작성일: 2026-06-23
-- 설명:
--   post_comments 에 parent_id 추가 → 댓글에 답글(대댓글) 1단계. (커뮤니티 118 과 동형)
--   · 1단계 강제: BEFORE INSERT 트리거가 parent 가 답글이면 그 최상위 댓글로 평탄화.
--   · 무결성: parent 가 다른 인증이거나 없으면 parent_id := NULL.
--   · 알림(072 갱신): 답글이면 '부모 댓글 작성자'에게, 일반 댓글이면 기존대로 '인증 작성자'에게.
--     + link_path 에 ?v=&c= 앵커 복원 → 알림 클릭 시 해당 댓글로 직접 스크롤.
--
--   하위호환: 기존 댓글 parent_id=NULL. 일반 댓글 알림 동작 유지.
--
-- 복구:
--   DROP TRIGGER IF EXISTS post_comment_flatten ON public.post_comments;
--   DROP FUNCTION IF EXISTS public.post_comment_flatten_parent();
--   ALTER TABLE public.post_comments DROP COLUMN IF EXISTS parent_id;
--   + 072 의 notify_on_post_comment() 본문 재실행.
-- ============================================================

-- 1) parent_id 컬럼 + 인덱스
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON public.post_comments(parent_id);

-- 2) 1단계 평탄화 + 무결성 트리거 (BEFORE INSERT)
CREATE OR REPLACE FUNCTION public.post_comment_flatten_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grandparent UUID;
  v_parent_vid UUID;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;

  SELECT parent_id, verification_id INTO v_grandparent, v_parent_vid
  FROM public.post_comments WHERE id = NEW.parent_id;

  IF NOT FOUND OR v_parent_vid IS DISTINCT FROM NEW.verification_id THEN
    NEW.parent_id := NULL;
    RETURN NEW;
  END IF;

  IF v_grandparent IS NOT NULL THEN
    NEW.parent_id := v_grandparent;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS post_comment_flatten ON public.post_comments;
CREATE TRIGGER post_comment_flatten
  BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.post_comment_flatten_parent();

-- 3) 알림 — 답글이면 부모 댓글 작성자, 일반 댓글이면 인증 작성자 + ?v=&c= 앵커
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
    '💬 ' || COALESCE(v_actor_nickname, '(?)') || '님이 ' || v_verb || '을 남겼어요',
    v_mission_title || ' — ' || LEFT(NEW.content, 60) || CASE WHEN length(NEW.content) > 60 THEN '...' ELSE '' END,
    '/programs/' || v_program_id::text || '/feed?v=' || NEW.verification_id::text || '&c=' || NEW.id::text,
    NEW.user_id,
    'post_comments',
    NEW.id
  );

  RETURN NEW;
END;
$$;
