-- ============================================================
-- Migration: 115 - 신고 접수 알림 (운영자에게)
-- 작성일: 2026-06-23
-- 설명:
--   참여자가 다른 참여자의 게시글/인증을 신고(reports INSERT)하면 프로그램
--   운영자에게 'REPORT_RECEIVED'('🚩 신고가 접수됐어요') 알림을 보낸다.
--   클릭 시 해당 게시글/인증으로 딥링크.
--     · post         → /programs/:id?tab=community&board=<board>&post=<post_id>
--     · verification → /programs/:id/feed?v=<verification_id>
--   신고자 본인이 운영자면 제외. 신고자 신원은 본문에 노출하지 않음(보복 방지).
--   100 의 report_auto_hide 트리거와 공존(별도 AFTER INSERT 트리거).
--
--   1) type CHECK 에 REPORT_RECEIVED 추가
--   2) is_notification_enabled 매핑(request_enabled — 운영자 처리성 알림)
--   3) reports AFTER INSERT 트리거
--
-- 영향: 신규 타입/트리거만. 기존 동작 무변경.
--
-- 복구:
--   DROP TRIGGER IF EXISTS reports_notify_owner ON public.reports;
--   DROP FUNCTION IF EXISTS public.notify_on_report_received();
--   + 110 의 type CHECK / is_notification_enabled 재실행.
-- ============================================================

-- 1) type CHECK 확장 (REPORT_RECEIVED 추가)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'REVIEW_APPROVED', 'REVIEW_REJECTED', 'POST_LIKE', 'POST_COMMENT',
    'PARTICIPANT_JOINED', 'VERIFICATION_SUBMITTED', 'POST_PENDING',
    'POST_APPROVED', 'POST_REJECTED', 'REPORT_RECEIVED'
  ));

-- 2) 수신 선호 매핑 (REPORT_RECEIVED → request_enabled)
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
    WHEN 'POST_APPROVED'          THEN v_pref.verify_enabled
    WHEN 'POST_REJECTED'          THEN v_pref.verify_enabled
    WHEN 'REPORT_RECEIVED'        THEN v_pref.request_enabled
    ELSE TRUE
  END;
END;
$$;

-- 3) 신고 접수 알림 트리거 (reports AFTER INSERT)
CREATE OR REPLACE FUNCTION public.notify_on_report_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_program_name TEXT;
  v_label TEXT;
  v_board_id TEXT;
  v_kind TEXT;
  v_link TEXT;
BEGIN
  SELECT owner_id, name INTO v_owner_id, v_program_name
  FROM public.programs WHERE id = NEW.program_id;

  -- 운영자 부재 / 운영자 본인 신고는 제외
  IF v_owner_id IS NULL OR v_owner_id = NEW.reporter_id THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_notification_enabled(v_owner_id, 'REPORT_RECEIVED') THEN
    RETURN NEW;
  END IF;

  IF NEW.target_type = 'post' THEN
    SELECT COALESCE(NULLIF(btrim(title), ''), LEFT(COALESCE(body, ''), 20), '게시글'), board_id
    INTO v_label, v_board_id
    FROM public.community_posts WHERE id = NEW.target_id;
    v_kind := '게시글';
    v_link := '/programs/' || NEW.program_id::text
      || '?tab=community&board=' || COALESCE(v_board_id, 'all')
      || '&post=' || NEW.target_id::text;
  ELSE  -- 'verification'
    SELECT m.title INTO v_label
    FROM public.verifications ver
    JOIN public.missions m ON m.id = ver.mission_id
    WHERE ver.id = NEW.target_id;
    v_kind := '인증';
    v_link := '/programs/' || NEW.program_id::text || '/feed?v=' || NEW.target_id::text;
  END IF;

  v_label := COALESCE(v_label, CASE WHEN NEW.target_type = 'post' THEN '게시글' ELSE '인증' END);

  INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
  VALUES (
    v_owner_id,
    'REPORT_RECEIVED',
    '🚩 신고가 접수됐어요',
    v_kind || ' “' || v_label || '”에 대한 신고가 접수됐어요 (' || COALESCE(v_program_name, '') || ')',
    v_link,
    CASE WHEN NEW.target_type = 'post' THEN 'community_posts' ELSE 'verifications' END,
    NEW.target_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_notify_owner ON public.reports;
CREATE TRIGGER reports_notify_owner
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_report_received();
