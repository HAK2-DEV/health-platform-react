-- ============================================================
-- Migration: 185 - 새 콘텐츠 알림 타입별 세분화 (미션·퀴즈·클래스·공지 각각)
-- 작성일: 2026-07-30
-- 설명:
--   184 의 단일 플래그(programs.notify_new_content / prefs.content_enabled)를 타입별로 세분화.
--   - 운영자(프로그램별): notify_new_mission / _quiz / _class / _notice (기본 TRUE) — 유형별 발송 on/off.
--   - 참여자(선호): content_mission_enabled / _quiz / _class / _notice (기본 TRUE) — 유형별 수신 on/off.
--     참여자 마스터(content_enabled)와 AND 로 결합(마스터 OFF 면 전부 OFF).
--   - 헬퍼는 유형별 프로그램 플래그를 확인, is_notification_enabled 는 유형별 선호 AND 마스터.
--   기존 notify_new_content / content_enabled 컬럼은 마스터로 유지(하위호환).
--
-- 하위호환: 컬럼 추가(기본 TRUE)·CREATE OR REPLACE. 기존 동작 유지(전부 기본 ON).
-- ============================================================

-- 1) 운영자 프로그램별 유형 플래그
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS notify_new_mission BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_new_quiz    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_new_class   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_new_notice  BOOLEAN NOT NULL DEFAULT TRUE;

-- 2) 참여자 유형 선호
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS content_mission_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS content_quiz_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS content_class_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS content_notice_enabled  BOOLEAN NOT NULL DEFAULT TRUE;

-- 3) is_notification_enabled — NEW_* 는 마스터(content_enabled) AND 유형별 선호
CREATE OR REPLACE FUNCTION public.is_notification_enabled(p_user_id UUID, p_type TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pref public.notification_preferences;
BEGIN
  SELECT * INTO v_pref FROM public.notification_preferences WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN TRUE; END IF;
  RETURN CASE p_type
    WHEN 'POST_LIKE'              THEN v_pref.like_enabled
    WHEN 'POST_COMMENT'           THEN v_pref.comment_enabled
    WHEN 'REVIEW_APPROVED'        THEN v_pref.verify_enabled
    WHEN 'REVIEW_REJECTED'        THEN v_pref.verify_enabled
    WHEN 'VERIFICATION_SUBMITTED' THEN v_pref.verify_enabled
    WHEN 'PARTICIPANT_JOINED'     THEN v_pref.request_enabled
    WHEN 'NEW_MISSION'            THEN v_pref.content_enabled AND v_pref.content_mission_enabled
    WHEN 'NEW_QUIZ'               THEN v_pref.content_enabled AND v_pref.content_quiz_enabled
    WHEN 'NEW_CLASS'              THEN v_pref.content_enabled AND v_pref.content_class_enabled
    WHEN 'NEW_NOTICE'             THEN v_pref.content_enabled AND v_pref.content_notice_enabled
    ELSE TRUE
  END;
END;
$$;

-- 4) 헬퍼 — 유형별 프로그램 플래그 확인 (PUBLISHED + 유형 ON + 참여자 선호는 is_notification_enabled 로)
CREATE OR REPLACE FUNCTION public.notify_participants_new_content(
  p_program_id UUID, p_type TEXT, p_title TEXT, p_body TEXT, p_link TEXT,
  p_ref_table TEXT, p_ref_id UUID, p_exclude UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pub BOOLEAN; v_flag BOOLEAN; v_prog public.programs;
BEGIN
  SELECT * INTO v_prog FROM public.programs WHERE id = p_program_id;
  v_pub := (v_prog.status = 'PUBLISHED');
  v_flag := CASE p_type
    WHEN 'NEW_MISSION' THEN v_prog.notify_new_mission
    WHEN 'NEW_QUIZ'    THEN v_prog.notify_new_quiz
    WHEN 'NEW_CLASS'   THEN v_prog.notify_new_class
    WHEN 'NEW_NOTICE'  THEN v_prog.notify_new_notice
    ELSE TRUE
  END;
  IF NOT (COALESCE(v_pub, FALSE) AND COALESCE(v_flag, TRUE)) THEN RETURN; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
  SELECT pp.user_id, p_type, p_title, p_body, p_link, p_ref_table, p_ref_id
  FROM public.program_participants pp
  WHERE pp.program_id = p_program_id AND pp.status = 'ACTIVE'
    AND (p_exclude IS NULL OR pp.user_id <> p_exclude)
    AND public.is_notification_enabled(pp.user_id, p_type);
END;
$$;
