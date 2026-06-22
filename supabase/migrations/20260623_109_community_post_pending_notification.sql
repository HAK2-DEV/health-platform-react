-- ============================================================
-- Migration: 109 - 게시글 검토 대기 알림 (운영자)
-- 작성일: 2026-06-23
-- 설명:
--   「승인 필요」 게시판에 참여자가 글을 올리면(status='pending') 운영자에게 알림.
--   클릭 시 link_path 로 프로그램 커뮤니티 탭 + 통합 검토함을 연다.
--
--   1) notifications.type CHECK 에 'POST_PENDING' 추가
--   2) is_notification_enabled 에 POST_PENDING → request_enabled 매핑
--      (가입 승인 요청과 같은 「요청」 알림 선호를 따름)
--   3) community_posts AFTER INSERT 트리거 — status='pending' 일 때만 운영자에게 알림
--      · 본인(운영자) 글은 제외, 수신 선호 OFF 면 제외 (042/072 패턴)
--      · 096 의 community_post_set_status(BEFORE INSERT) 가 status 를 먼저 정하므로
--        AFTER INSERT 에서 최종 status 를 보고 판단 → 공존 OK
--
-- 영향: 신규 타입/트리거만 추가. 기존 알림 동작 무변경. link_path 미배포여도 커뮤니티 탭 이동은 됨.
--
-- 복구:
--   DROP TRIGGER IF EXISTS community_post_pending_notify ON public.community_posts;
--   DROP FUNCTION IF EXISTS public.notify_on_community_post_pending();
--   (type CHECK 는 POST_PENDING 제거 시 해당 알림 행부터 정리 필요)
-- ============================================================

-- 1) type CHECK 확장
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'REVIEW_APPROVED', 'REVIEW_REJECTED', 'POST_LIKE', 'POST_COMMENT',
    'PARTICIPANT_JOINED', 'VERIFICATION_SUBMITTED', 'POST_PENDING'
  ));

-- 2) 수신 선호 매핑에 POST_PENDING 추가 (request_enabled)
CREATE OR REPLACE FUNCTION public.is_notification_enabled(
  p_user_id UUID,
  p_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pref public.notification_preferences;
BEGIN
  SELECT * INTO v_pref FROM public.notification_preferences WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  RETURN CASE p_type
    WHEN 'POST_LIKE'              THEN v_pref.like_enabled
    WHEN 'POST_COMMENT'           THEN v_pref.comment_enabled
    WHEN 'REVIEW_APPROVED'        THEN v_pref.verify_enabled
    WHEN 'REVIEW_REJECTED'        THEN v_pref.verify_enabled
    WHEN 'VERIFICATION_SUBMITTED' THEN v_pref.verify_enabled
    WHEN 'PARTICIPANT_JOINED'     THEN v_pref.request_enabled
    WHEN 'POST_PENDING'           THEN v_pref.request_enabled
    ELSE TRUE
  END;
END;
$$;

-- 3) 검토 대기 글 → 운영자 알림 트리거
CREATE OR REPLACE FUNCTION public.notify_on_community_post_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_program_name TEXT;
  v_actor_nickname TEXT;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT owner_id, name INTO v_owner_id, v_program_name
  FROM public.programs WHERE id = NEW.program_id;

  -- 운영자 본인 글이거나 수신 선호 OFF 면 알림 X
  IF v_owner_id IS NULL OR v_owner_id = NEW.author_id THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_notification_enabled(v_owner_id, 'POST_PENDING') THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.author_id;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_owner_id,
    'POST_PENDING',
    '📝 게시글 검토 요청',
    COALESCE(v_actor_nickname, '(?)') || '님이 글을 올렸어요 — 검토 후 게시돼요 (' || COALESCE(v_program_name, '') || ')',
    '/programs/' || NEW.program_id::text || '?tab=community&review=1',
    NEW.author_id,
    'community_posts',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_post_pending_notify ON public.community_posts;
CREATE TRIGGER community_post_pending_notify
  AFTER INSERT ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_community_post_pending();
