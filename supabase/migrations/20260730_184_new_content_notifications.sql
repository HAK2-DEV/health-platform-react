-- ============================================================
-- Migration: 184 - 새 콘텐츠(미션·퀴즈·클래스·공지) → 참여자 알림
-- 작성일: 2026-07-30
-- 설명:
--   운영자가 새 미션/퀴즈/클래스(세션)/공지(운영자 커뮤니티 글)를 만들면 ACTIVE 참여자에게 알림.
--   - 스팸 방지: 프로그램 PUBLISHED + programs.notify_new_content(기본 TRUE) + 참여자 선호(content_enabled) 일 때만.
--   - 운영자 기본값 = 보냄(notify_new_content 기본 TRUE). 참여자 기본값 = 받음(content_enabled 기본 TRUE).
--   - notifications INSERT → 기존 pg_net 트리거로 폰 푸시도 자동.
--   신규 타입: NEW_MISSION / NEW_QUIZ / NEW_CLASS / NEW_NOTICE (→ 모두 content_enabled 로 제어).
--
-- 하위호환: 컬럼 추가(기본값)·CHECK 확장·CREATE OR REPLACE·신규 트리거. 기존 동작 무변경.
-- 복구: 하단 DROP 참고.
-- ============================================================

-- 1) 알림 type CHECK 확장 (기존 174 목록 + 신규 4종)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'REVIEW_APPROVED', 'REVIEW_REJECTED', 'POST_LIKE', 'POST_COMMENT',
  'PARTICIPANT_JOINED', 'VERIFICATION_SUBMITTED', 'POST_PENDING',
  'POST_APPROVED', 'POST_REJECTED', 'REPORT_RECEIVED',
  'TEAM_INVITE', 'TEAM_JOINED', 'TEAM_REMOVED', 'TEAM_LEADER_CHANGED',
  'INQUIRY_RECEIVED', 'INQUIRY_ANSWERED',
  'OPERATOR_CHEER', 'CONTENT_HIDDEN',
  'NEW_MISSION', 'NEW_QUIZ', 'NEW_CLASS', 'NEW_NOTICE'
));

-- 2) 참여자 선호 — 새 소식 알림 (기본 ON)
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS content_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 3) 운영자 프로그램별 — 새 소식 알림 보내기 (기본 ON)
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS notify_new_content BOOLEAN NOT NULL DEFAULT TRUE;

-- 4) is_notification_enabled — NEW_* 는 content_enabled 로 매핑
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
    WHEN 'NEW_MISSION'            THEN v_pref.content_enabled
    WHEN 'NEW_QUIZ'               THEN v_pref.content_enabled
    WHEN 'NEW_CLASS'              THEN v_pref.content_enabled
    WHEN 'NEW_NOTICE'             THEN v_pref.content_enabled
    ELSE TRUE
  END;
END;
$$;

-- 5) 공용 헬퍼 — ACTIVE 참여자 일괄 알림(선호·프로그램 플래그·발행 확인 포함, 작성자 제외)
CREATE OR REPLACE FUNCTION public.notify_participants_new_content(
  p_program_id UUID, p_type TEXT, p_title TEXT, p_body TEXT, p_link TEXT,
  p_ref_table TEXT, p_ref_id UUID, p_exclude UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ok BOOLEAN;
BEGIN
  SELECT (status = 'PUBLISHED' AND COALESCE(notify_new_content, TRUE))
  INTO v_ok FROM public.programs WHERE id = p_program_id;
  IF NOT COALESCE(v_ok, FALSE) THEN RETURN; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
  SELECT pp.user_id, p_type, p_title, p_body, p_link, p_ref_table, p_ref_id
  FROM public.program_participants pp
  LEFT JOIN public.notification_preferences np ON np.user_id = pp.user_id
  WHERE pp.program_id = p_program_id AND pp.status = 'ACTIVE'
    AND (p_exclude IS NULL OR pp.user_id <> p_exclude)
    AND COALESCE(np.content_enabled, TRUE);
END;
$$;

-- 6) 트리거 — 미션
CREATE OR REPLACE FUNCTION public.trg_notify_new_mission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_participants_new_content(
    NEW.program_id, 'NEW_MISSION', '🌱 새 미션', COALESCE(NEW.title, '새 미션'),
    '/programs/' || NEW.program_id::text || '?tab=missions', 'missions', NEW.id, NULL);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_new_mission ON public.missions;
CREATE TRIGGER notify_new_mission AFTER INSERT ON public.missions FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_mission();

-- 7) 트리거 — 퀴즈 (작성자 제외)
CREATE OR REPLACE FUNCTION public.trg_notify_new_quiz() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_participants_new_content(
    NEW.program_id, 'NEW_QUIZ', '❓ 새 퀴즈', COALESCE(NEW.title, '새 퀴즈'),
    '/programs/' || NEW.program_id::text || '?tab=quizzes', 'quizzes', NEW.id, NEW.created_by);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_new_quiz ON public.quizzes;
CREATE TRIGGER notify_new_quiz AFTER INSERT ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_quiz();

-- 8) 트리거 — 클래스(세션)
CREATE OR REPLACE FUNCTION public.trg_notify_new_session() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_participants_new_content(
    NEW.program_id, 'NEW_CLASS', '📅 새 클래스', COALESCE(NEW.title, '새 클래스'),
    '/programs/' || NEW.program_id::text || '?tab=classes', 'sessions', NEW.id, NULL);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_new_session ON public.sessions;
CREATE TRIGGER notify_new_session AFTER INSERT ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_session();

-- 9) 트리거 — 공지 (운영자(owner) 작성 커뮤니티 글, 노출 상태만)
CREATE OR REPLACE FUNCTION public.trg_notify_new_notice() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner UUID;
BEGIN
  SELECT owner_id INTO v_owner FROM public.programs WHERE id = NEW.program_id;
  IF NEW.author_id IS DISTINCT FROM v_owner THEN RETURN NEW; END IF;      -- 운영자 글만 공지로
  IF COALESCE(NEW.status, 'visible') <> 'visible' THEN RETURN NEW; END IF; -- 검토대기/숨김 제외
  PERFORM public.notify_participants_new_content(
    NEW.program_id, 'NEW_NOTICE', '📢 새 공지',
    COALESCE(NULLIF(btrim(NEW.title), ''), LEFT(COALESCE(NEW.body, ''), 40), '새 공지'),
    '/programs/' || NEW.program_id::text || '?tab=community&board=' || NEW.board_id || '&post=' || NEW.id::text,
    'community_posts', NEW.id, NEW.author_id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_new_notice ON public.community_posts;
CREATE TRIGGER notify_new_notice AFTER INSERT ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_notice();

-- 복구:
--   DROP TRIGGER ... (notify_new_mission/quiz/session/notice) + DROP FUNCTION trg_* / notify_participants_new_content;
--   ALTER TABLE public.notification_preferences DROP COLUMN content_enabled;
--   ALTER TABLE public.programs DROP COLUMN notify_new_content;
--   is_notification_enabled 은 072 버전으로 되돌리거나 그대로(신규 타입은 ELSE TRUE 로 무해).
