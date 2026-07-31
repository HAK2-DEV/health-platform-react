-- ============================================================
-- Migration: 192 - 새 콘텐츠 알림 제목 "새 X" → "새로운 X"
-- 작성일: 2026-07-31
-- 설명:
--   새 미션/퀴즈/클래스(+공지) 알림의 제목을 "새로운 미션/퀴즈/클래스/공지"로.
--   구조는 그대로(제목=짧은 라벨, 본문=콘텐츠 제목) → iOS 제목 잘림 없음.
--   trg_notify_new_mission/quiz/session/notice 함수 title 만 변경(로직·링크·본문 동일).
--
-- 하위호환: CREATE OR REPLACE 만. 트리거 바인딩·과거 알림 무영향.
-- 복구: 184 정의로 재실행.
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_notify_new_mission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_participants_new_content(
    NEW.program_id, 'NEW_MISSION', '🌱 새로운 미션', COALESCE(NEW.title, '새로운 미션'),
    '/programs/' || NEW.program_id::text || '?tab=missions', 'missions', NEW.id, NULL);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_notify_new_quiz() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_participants_new_content(
    NEW.program_id, 'NEW_QUIZ', '❓ 새로운 퀴즈', COALESCE(NEW.title, '새로운 퀴즈'),
    '/programs/' || NEW.program_id::text || '?tab=quizzes', 'quizzes', NEW.id, NEW.created_by);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_notify_new_session() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_participants_new_content(
    NEW.program_id, 'NEW_CLASS', '📅 새로운 클래스', COALESCE(NEW.title, '새로운 클래스'),
    '/programs/' || NEW.program_id::text || '?tab=classes', 'sessions', NEW.id, NULL);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_notify_new_notice() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner UUID;
BEGIN
  SELECT owner_id INTO v_owner FROM public.programs WHERE id = NEW.program_id;
  IF NEW.author_id IS DISTINCT FROM v_owner THEN RETURN NEW; END IF;
  IF COALESCE(NEW.status, 'visible') <> 'visible' THEN RETURN NEW; END IF;
  PERFORM public.notify_participants_new_content(
    NEW.program_id, 'NEW_NOTICE', '📢 새로운 공지',
    COALESCE(NULLIF(btrim(NEW.title), ''), LEFT(COALESCE(NEW.body, ''), 40), '새로운 공지'),
    '/programs/' || NEW.program_id::text || '?tab=community&board=' || NEW.board_id || '&post=' || NEW.id::text,
    'community_posts', NEW.id, NEW.author_id);
  RETURN NEW;
END; $$;
