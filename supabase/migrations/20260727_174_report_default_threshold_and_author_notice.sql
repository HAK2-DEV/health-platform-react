-- ============================================================
-- Migration: 174 - 자동 숨김 기본 임계 상향(1→2) + 숨김 시 작성자 알림
-- 작성일: 2026-07-27
-- 설명:
--   무단(악의적) 신고 피해 방지. 두 가지를 report_auto_hide() 에 반영한다.
--   1) 기본 임계값 상향
--      · 기존: reportPolicy 미설정(NULL) 또는 'auto' → 임계 1 (신고자 1명이면 즉시 숨김).
--        신고자 1명만으로 남의 글이 가려지는 게 무단 신고 피해의 핵심이었음.
--      · 변경: '2' → 2 를 새로 인식. 미설정(NULL)/알 수 없는 값의 기본을 2 로.
--        즉 "서로 다른 2명 이상"이 신고해야 자동 숨김.
--        (reports 의 UNIQUE(target_type,target_id,reporter_id) 로 1인 1신고 →
--         미처리 신고 수 = 서로 다른 신고자 수.)
--      · 'auto'(즉시 숨김·1회)는 운영자가 UI 에서 명시적으로 고르는 옵션이므로
--        1 로 그대로 유지(라벨 "신고 1회로 바로 숨김"과 일치). '3'/'5' 도 유지.
--   2) 숨김 시 작성자 알림 (신규 type 'CONTENT_HIDDEN')
--      · 임계 도달로 콘텐츠가 '방금' 숨겨졌을 때만(UPDATE ... RETURNING) 작성자에게
--        "신고 접수로 잠시 가려졌고 운영자 확인 후 결정된다"는 알림을 보냄.
--        지금은 조용히 사라져 작성자가 이유를 몰랐음 → 투명성 + 소명(고객센터) 안내.
--      · 작성자 == 신고자면(자기 콘텐츠 자가신고 edge) 알림 생략.
--      · 이미 숨김 상태면 RETURNING 이 NULL → 중복 알림 없음.
--
-- 하위호환:
--   · CREATE OR REPLACE FUNCTION (트리거 재생성 없음, 타이밍 유지).
--   · 임계 기본이 1→2 로 올라가는 것은 "덜 숨기는" 방향이라 기존 콘텐츠를
--     새로 차단하지 않음(권한 넓힘). 명시 설정('auto'/'3'/'5')은 동작 불변.
--   · type CHECK 는 'CONTENT_HIDDEN' 추가(확장). is_notification_enabled 은
--     미매핑 타입에 ELSE TRUE 이므로 별도 수정 없이 기본 수신.
--
-- 복구:
--   · report_auto_hide() 를 168 본문으로 CREATE OR REPLACE.
--   · type CHECK 에서 'CONTENT_HIDDEN' 제거(165 본문 재실행).
-- ============================================================

-- 1) 알림 type CHECK 확장 (CONTENT_HIDDEN 추가 — 기존 165 목록 + 신규)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'REVIEW_APPROVED', 'REVIEW_REJECTED', 'POST_LIKE', 'POST_COMMENT',
    'PARTICIPANT_JOINED', 'VERIFICATION_SUBMITTED', 'POST_PENDING',
    'POST_APPROVED', 'POST_REJECTED', 'REPORT_RECEIVED',
    'TEAM_INVITE', 'TEAM_JOINED', 'TEAM_REMOVED', 'TEAM_LEADER_CHANGED',
    'INQUIRY_RECEIVED', 'INQUIRY_ANSWERED',
    'OPERATOR_CHEER',
    'CONTENT_HIDDEN'
  ));

-- 2) 자동 숨김 트리거 재작성
CREATE OR REPLACE FUNCTION public.report_auto_hide()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_policy TEXT;
  v_threshold INT;
  v_count INT;
  v_program_name TEXT;
  v_author_id UUID;
  v_label TEXT;
  v_board_id TEXT;
  v_kind TEXT;
  v_link TEXT;
BEGIN
  SELECT community_settings->>'reportPolicy', name
    INTO v_policy, v_program_name
    FROM public.programs WHERE id = NEW.program_id;

  v_threshold := CASE v_policy
    WHEN 'auto' THEN 1   -- 운영자가 명시적으로 '즉시 숨김(1회)' 선택
    WHEN '2'    THEN 2
    WHEN '3'    THEN 3
    WHEN '5'    THEN 5
    ELSE 2               -- 미설정(NULL)/알 수 없는 값 → 기본 2 (서로 다른 2명)
  END;

  -- 미처리(resolved=false) 신고만 카운트 (168 유지)
  SELECT count(*) INTO v_count FROM public.reports
   WHERE target_type = NEW.target_type AND target_id = NEW.target_id
     AND resolved = false;

  IF v_count < v_threshold THEN
    RETURN NEW;
  END IF;

  -- 임계 도달 → 숨김. '방금' 숨겨진 경우에만(RETURNING) 작성자 알림.
  IF NEW.target_type = 'post' THEN
    UPDATE public.community_posts
       SET status = 'hidden'
     WHERE id = NEW.target_id AND status <> 'hidden'
     RETURNING author_id,
               COALESCE(NULLIF(btrim(title), ''), LEFT(COALESCE(body, ''), 20), '게시글'),
               board_id
       INTO v_author_id, v_label, v_board_id;
    v_kind := '게시글';
    v_link := '/programs/' || NEW.program_id::text
              || '?tab=community&board=' || COALESCE(v_board_id, 'all')
              || '&post=' || NEW.target_id::text;
  ELSIF NEW.target_type = 'verification' THEN
    UPDATE public.verifications
       SET feed_visible = false
     WHERE id = NEW.target_id AND feed_visible = true
     RETURNING user_id INTO v_author_id;
    IF v_author_id IS NOT NULL THEN
      SELECT m.title INTO v_label
        FROM public.verifications ver
        JOIN public.missions m ON m.id = ver.mission_id
       WHERE ver.id = NEW.target_id;
    END IF;
    v_kind := '인증';
    v_link := '/programs/' || NEW.program_id::text;
  END IF;

  -- 방금 숨겨졌고, 작성자 본인이 신고자가 아니면 알림
  IF v_author_id IS NOT NULL AND v_author_id <> NEW.reporter_id THEN
    v_label := COALESCE(v_label, v_kind);
    IF public.is_notification_enabled(v_author_id, 'CONTENT_HIDDEN') THEN
      INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
      VALUES (
        v_author_id,
        'CONTENT_HIDDEN',
        '🔒 콘텐츠가 검토 중이에요',
        '내 ' || v_kind || ' “' || v_label || '”이(가) 신고 접수로 잠시 가려졌어요. '
          || '운영자 확인 후 결정돼요. 이의가 있으면 고객센터로 문의해 주세요.'
          || COALESCE(' (' || v_program_name || ')', ''),
        v_link,
        CASE WHEN NEW.target_type = 'post' THEN 'community_posts' ELSE 'verifications' END,
        NEW.target_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
