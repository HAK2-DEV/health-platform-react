-- ============================================================
-- Migration: 041 - 알림 자동 생성 트리거 3개
-- 작성일: 2026-05-25
-- 설명: 알림 발생 이벤트 → notifications INSERT (SECURITY DEFINER 로 RLS 우회).
--   본인의 MVP 1차 — 참여자 앞단 알림 3종.
--
-- 트리거:
--   1) notify_on_verification_review
--      verifications.status: PENDING_REVIEW → APPROVED/REJECTED
--      → 본인 (v.user_id) 에게 알림
--
--   2) notify_on_post_like
--      post_likes INSERT
--      → 인증 작성자 (v.user_id) 에게 알림 (단, 본인이 본인 인증에 좋아요는 알림 X)
--
--   3) notify_on_post_comment
--      post_comments INSERT
--      → 인증 작성자에게 알림 (단, 본인 댓글은 알림 X)
--
-- 본인의 미션 제목 / 닉네임 등은 트리거 안에서 JOIN 해서 title/body 에 packed.
-- link_path: 피드 페이지로 (좋아요/댓글) 또는 프로그램 상세 (심사 결과)
--
-- 복구:
--   supabase/rollbacks/041_revert_notification_triggers.sql 수동 실행.
-- ============================================================

-- ─── 1) 심사 결과 알림 ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_verification_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission_title TEXT;
  v_program_id UUID;
  v_program_name TEXT;
  v_point INT;
BEGIN
  -- PENDING_REVIEW → APPROVED/REJECTED 만 처리
  IF OLD.status != 'PENDING_REVIEW' THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('APPROVED', 'REJECTED') THEN RETURN NEW; END IF;

  SELECT m.title, m.program_id, m.point, p.name
  INTO v_mission_title, v_program_id, v_point, v_program_name
  FROM public.missions m
  JOIN public.programs p ON p.id = m.program_id
  WHERE m.id = NEW.mission_id;

  IF NEW.status = 'APPROVED' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
    VALUES (
      NEW.user_id,
      'REVIEW_APPROVED',
      '✅ 인증이 승인됐어요',
      v_mission_title || ' — +' || v_point || 'P 획득 (' || v_program_name || ')',
      '/programs/' || v_program_id::text,
      'verifications',
      NEW.id
    );
  ELSIF NEW.status = 'REJECTED' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
    VALUES (
      NEW.user_id,
      'REVIEW_REJECTED',
      '❌ 인증이 반려됐어요',
      v_mission_title || COALESCE(' — ' || NEW.rejection_reason, '') || ' (' || v_program_name || ')',
      '/programs/' || v_program_id::text,
      'verifications',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_review_on_verifications ON public.verifications;
CREATE TRIGGER notify_review_on_verifications
AFTER UPDATE OF status ON public.verifications
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_verification_review();


-- ─── 2) 좋아요 알림 ──────────────────────────────────────
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
  -- 인증 작성자 + 프로그램
  SELECT v.user_id, m.program_id, m.title
  INTO v_owner_id, v_program_id, v_mission_title
  FROM public.verifications v
  JOIN public.missions m ON m.id = v.mission_id
  WHERE v.id = NEW.verification_id;

  -- 본인이 본인 인증에 좋아요는 알림 X
  IF v_owner_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_owner_id,
    'POST_LIKE',
    '❤️ ' || COALESCE(v_actor_nickname, '(?)') || '님이 좋아해요',
    v_mission_title,
    '/programs/' || v_program_id::text || '/feed',
    NEW.user_id,
    'post_likes',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_like_on_post_likes ON public.post_likes;
CREATE TRIGGER notify_like_on_post_likes
AFTER INSERT ON public.post_likes
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_post_like();


-- ─── 3) 댓글 알림 ────────────────────────────────────────
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

  -- 본인 댓글은 알림 X
  IF v_owner_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_owner_id,
    'POST_COMMENT',
    '💬 ' || COALESCE(v_actor_nickname, '(?)') || '님이 댓글을 남겼어요',
    v_mission_title || ' — ' || LEFT(NEW.content, 60) || CASE WHEN length(NEW.content) > 60 THEN '...' ELSE '' END,
    '/programs/' || v_program_id::text || '/feed',
    NEW.user_id,
    'post_comments',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_comment_on_post_comments ON public.post_comments;
CREATE TRIGGER notify_comment_on_post_comments
AFTER INSERT ON public.post_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_post_comment();
