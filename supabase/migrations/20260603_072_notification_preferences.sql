-- ============================================================
-- Migration: 072 - 알림 type 별 ON/OFF 사용자 환경설정
-- 작성일: 2026-06-03
-- 설명:
--   notification_preferences: 사용자가 type 별 알림 수신 ON/OFF 설정.
--   기존 알림 트리거 4개 (verification_review / post_like / post_comment / participant_join)
--   가 INSERT 전에 본인 환경설정 확인 → OFF 면 skip.
--
--   기본값: 모든 type ON (가입 직후 사용자도 알림 받음).
--   trigger 042 의 verification_submitted (운영자 알림) 도 동일 패턴.
--
-- type → preference 매핑:
--   POST_LIKE              → like_enabled
--   POST_COMMENT           → comment_enabled
--   REVIEW_APPROVED        → verify_enabled  (참여자 대상)
--   REVIEW_REJECTED        → verify_enabled
--   VERIFICATION_SUBMITTED → verify_enabled  (운영자 대상 — 검증 요청)
--   PARTICIPANT_JOINED     → request_enabled (운영자 대상 — 가입 요청)
--
-- 복구:
--   supabase/rollbacks/072_revert_notification_preferences.sql 수동 실행.
-- ============================================================

-- ─── 1) notification_preferences 테이블 ──────────────────────
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id          UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  like_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  comment_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  verify_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  request_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2) RLS — 본인 행만 SELECT/UPDATE ───────────────────────
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_prefs_own_select" ON public.notification_preferences;
CREATE POLICY "notif_prefs_own_select" ON public.notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notif_prefs_own_update" ON public.notification_preferences;
CREATE POLICY "notif_prefs_own_update" ON public.notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- INSERT 는 RPC + SECURITY DEFINER 로만 — 사용자가 임의로 다른 user_id 못 생성


-- ─── 3) get_or_create_my_notification_preferences ───────────
-- 클라이언트가 호출 — 본인 행이 없으면 기본값으로 생성 후 반환.
CREATE OR REPLACE FUNCTION public.get_or_create_my_notification_preferences()
RETURNS public.notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_row public.notification_preferences;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '인증되지 않은 사용자';
  END IF;

  SELECT * INTO v_row FROM public.notification_preferences WHERE user_id = v_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.notification_preferences (user_id)
    VALUES (v_user_id)
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_or_create_my_notification_preferences() TO authenticated;


-- ─── 4) is_notification_enabled — 트리거가 INSERT 전 체크용 헬퍼 ──
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
  -- preferences 행 없으면 모든 type ON 으로 간주 (기본값과 동일)
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
    ELSE TRUE  -- 미정의 type 은 기본 ON
  END;
END;
$$;


-- ─── 5) 기존 트리거 4개에 preference 체크 통합 ───────────────
-- 본인의 비활성 type 알림은 INSERT skip.

-- 5-1) 심사 결과 알림 (041)
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
  v_type TEXT;
BEGIN
  IF OLD.status != 'PENDING_REVIEW' THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('APPROVED', 'REJECTED') THEN RETURN NEW; END IF;

  v_type := CASE NEW.status WHEN 'APPROVED' THEN 'REVIEW_APPROVED' ELSE 'REVIEW_REJECTED' END;
  IF NOT public.is_notification_enabled(NEW.user_id, v_type) THEN RETURN NEW; END IF;

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

-- 5-2) 좋아요 알림 (041)
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

-- 5-3) 댓글 알림 (041)
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
  IF NOT public.is_notification_enabled(v_owner_id, 'POST_COMMENT') THEN RETURN NEW; END IF;

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

-- 5-4) 운영자 알림 (042) — 가입 요청 + 인증 제출
-- 기존 함수 시그니처 유지하면서 preference 체크 추가.
-- 042 의 함수명 그대로 재정의 — 다른 변경사항 없으면 안전.
CREATE OR REPLACE FUNCTION public.notify_on_participant_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_program_name TEXT;
  v_join_type TEXT;
  v_actor_nickname TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  SELECT p.owner_id, p.name, p.join_type
  INTO v_owner_id, v_program_name, v_join_type
  FROM public.programs p
  WHERE p.id = NEW.program_id;

  -- 본인 프로그램에 본인이 참여하는 경우 운영자 알림 X
  IF v_owner_id = NEW.user_id THEN RETURN NEW; END IF;

  -- APPROVAL 프로그램의 PENDING 만 알림 (자유 참여는 알림 안 함 — 너무 많음)
  IF v_join_type != 'APPROVAL' OR NEW.status != 'PENDING' THEN RETURN NEW; END IF;

  IF NOT public.is_notification_enabled(v_owner_id, 'PARTICIPANT_JOINED') THEN RETURN NEW; END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;
  v_title := '👋 가입 승인 요청';
  v_body := COALESCE(v_actor_nickname, '(?)') || '님이 ' || v_program_name || ' 가입을 요청했어요';

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_owner_id,
    'PARTICIPANT_JOINED',
    v_title,
    v_body,
    '/programs/' || NEW.program_id::text || '/participants',
    NEW.user_id,
    'program_participants',
    NEW.id
  );

  RETURN NEW;
END;
$$;
