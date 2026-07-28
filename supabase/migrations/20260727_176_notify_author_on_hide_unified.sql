-- ============================================================
-- Migration: 176 - 콘텐츠 숨김 시 작성자 알림을 "숨김 전환" 트리거로 통합
-- 작성일: 2026-07-27
-- 설명:
--   174 는 자동 숨김(report_auto_hide) 안에서만 작성자 알림을 보냈다.
--   운영자가 신고 패널에서 「직접 가리기」한 경우엔 알림이 없었다.
--   → 알림을 "콘텐츠가 노출→숨김으로 바뀌는 순간"에 거는 UPDATE 트리거로 통합해
--     자동·수동 모든 숨김 경로를 한 곳에서 커버(중복 없음).
--
--   숨김으로 가는 경로는 두 가지뿐이고 둘 다 이 UPDATE 를 거친다:
--     · 자동: report_auto_hide() 가 verifications.feed_visible=false /
--             community_posts.status='hidden' 로 UPDATE
--     · 수동: setVerificationFeedVisible(false) / setCommunityPostStatus('hidden')
--   복원(feed_visible=true / status='visible')은 WHEN 조건에서 걸러져 알림 안 감.
--
--   구성:
--     1) verifications AFTER UPDATE 트리거 — false 로 전환 시 작성자(user_id) 알림
--     2) community_posts AFTER UPDATE 트리거 — 'hidden' 전환 시 작성자(author_id) 알림
--     3) report_auto_hide() 는 인라인 알림 제거(위 트리거가 대신 발화) — 174 의
--        임계값 로직(기본 2 · auto=1 · 3 · 5)은 그대로 유지.
--
--   알림 type 은 174 에서 추가한 'CONTENT_HIDDEN' 재사용. is_notification_enabled
--   미매핑 → 기본 수신(ELSE TRUE).
--
-- 하위호환: 트리거 신규 + 함수 CREATE OR REPLACE. 알림을 "옮기는" 것이라
--   자동 숨김 알림 동작은 사용자 입장에서 동일(발화 위치만 이동), 수동 숨김만 추가됨.
--
-- 복구:
--   DROP TRIGGER trg_notify_author_verification_hidden ON public.verifications;
--   DROP TRIGGER trg_notify_author_post_hidden ON public.community_posts;
--   DROP FUNCTION public.notify_author_verification_hidden();
--   DROP FUNCTION public.notify_author_post_hidden();
--   + report_auto_hide() 를 174 본문(인라인 알림 포함)으로 CREATE OR REPLACE.
-- ============================================================

-- 공통 문구
--   "내 <종류> "<제목>"이(가) 신고 접수로 잠시 가려졌어요. 운영자 확인 후 결정돼요.
--    이의가 있으면 고객센터로 문의해 주세요. (프로그램명)"

-- ── 1) 인증 숨김 → 작성자 알림 ────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_author_verification_hidden()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_program_id uuid;
  v_program_name text;
  v_title text;
BEGIN
  SELECT m.program_id, m.title, p.name
    INTO v_program_id, v_title, v_program_name
    FROM public.missions m
    JOIN public.programs p ON p.id = m.program_id
   WHERE m.id = NEW.mission_id;

  IF v_program_id IS NULL THEN RETURN NEW; END IF;
  IF NOT public.is_notification_enabled(NEW.user_id, 'CONTENT_HIDDEN') THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
  VALUES (
    NEW.user_id,
    'CONTENT_HIDDEN',
    '🔒 콘텐츠가 검토 중이에요',
    '내 인증 “' || COALESCE(v_title, '인증') || '”이(가) 신고 접수로 잠시 가려졌어요. '
      || '운영자 확인 후 결정돼요. 이의가 있으면 고객센터로 문의해 주세요.'
      || COALESCE(' (' || v_program_name || ')', ''),
    '/programs/' || v_program_id::text,
    'verifications',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_author_verification_hidden ON public.verifications;
CREATE TRIGGER trg_notify_author_verification_hidden
AFTER UPDATE ON public.verifications
FOR EACH ROW
WHEN (NEW.feed_visible = false AND OLD.feed_visible IS DISTINCT FROM NEW.feed_visible)
EXECUTE FUNCTION public.notify_author_verification_hidden();

-- ── 2) 게시글 숨김 → 작성자 알림 ──────────────────────────
CREATE OR REPLACE FUNCTION public.notify_author_post_hidden()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_program_name text;
  v_label text;
BEGIN
  SELECT name INTO v_program_name FROM public.programs WHERE id = NEW.program_id;
  IF NOT public.is_notification_enabled(NEW.author_id, 'CONTENT_HIDDEN') THEN RETURN NEW; END IF;

  v_label := COALESCE(NULLIF(btrim(NEW.title), ''), LEFT(COALESCE(NEW.body, ''), 20), '게시글');

  INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
  VALUES (
    NEW.author_id,
    'CONTENT_HIDDEN',
    '🔒 콘텐츠가 검토 중이에요',
    '내 게시글 “' || v_label || '”이(가) 신고 접수로 잠시 가려졌어요. '
      || '운영자 확인 후 결정돼요. 이의가 있으면 고객센터로 문의해 주세요.'
      || COALESCE(' (' || v_program_name || ')', ''),
    '/programs/' || NEW.program_id::text
      || '?tab=community&board=' || COALESCE(NEW.board_id, 'all')
      || '&post=' || NEW.id::text,
    'community_posts',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_author_post_hidden ON public.community_posts;
CREATE TRIGGER trg_notify_author_post_hidden
AFTER UPDATE ON public.community_posts
FOR EACH ROW
WHEN (NEW.status = 'hidden' AND OLD.status IS DISTINCT FROM 'hidden')
EXECUTE FUNCTION public.notify_author_post_hidden();

-- ── 3) report_auto_hide: 인라인 알림 제거(위 트리거가 대신 발화) ──
--   174 의 임계값 로직은 동일. 숨김 UPDATE 는 이제 알림 트리거를 발화시킨다.
CREATE OR REPLACE FUNCTION public.report_auto_hide()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_policy TEXT;
  v_threshold INT;
  v_count INT;
BEGIN
  SELECT community_settings->>'reportPolicy' INTO v_policy FROM public.programs WHERE id = NEW.program_id;

  v_threshold := CASE v_policy
    WHEN 'auto' THEN 1
    WHEN '2'    THEN 2
    WHEN '3'    THEN 3
    WHEN '5'    THEN 5
    ELSE 2
  END;

  SELECT count(*) INTO v_count FROM public.reports
   WHERE target_type = NEW.target_type AND target_id = NEW.target_id
     AND resolved = false;

  IF v_count < v_threshold THEN
    RETURN NEW;
  END IF;

  IF NEW.target_type = 'post' THEN
    UPDATE public.community_posts SET status = 'hidden'
     WHERE id = NEW.target_id AND status <> 'hidden';
  ELSIF NEW.target_type = 'verification' THEN
    UPDATE public.verifications SET feed_visible = false
     WHERE id = NEW.target_id AND feed_visible = true;
  END IF;

  RETURN NEW;
END;
$$;
