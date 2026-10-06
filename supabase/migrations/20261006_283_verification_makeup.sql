-- ============================================================
-- Migration: 283 - 만회 인증 (반려 뒤 24시간 안에 다시 올리면 원래 날로 인정)
-- 작성일: 2026-10-06
-- 설명:
--   본인 결정(2026-10-06). 실측(테스트 계정 제외): 반려 20건 중 같은 날 반려는 16% — 84%는 다음 날 이후라
--   그날 미션을 다시 할 수 없었고, 같은 미션 재인증은 5%. 반려 = 그날 기록이 영영 사라짐 → 억울함·이탈 지점.
--
--   규칙
--   1) 만회 = 반려된 인증을 가리키며(makeup_of) 새로 올리는 인증. 반려 시각(reviewed_at)부터 24시간 안.
--   2) 원래 날로 인정 — 서버가 submitted_at 을 «원래 인증의 제출 시각»으로 맞춘다(클라가 정하지 않는다).
--      하루 한도(169)·점수(276)·연속/불꽃(280)/완주(282) 집계가 전부 submitted_at 기준이라, 그 함수들을 손대지 않고
--      원래 날에 들어간다. 실제로 올린 시각은 makeup_at 에 남긴다.
--   3) 만회는 늘 운영자 심사(PENDING_REVIEW) — 자동 승인 미션이라도. «점수 제외»(자동 승인 악용) 뒤
--      다시 자동 승인되는 고리를 끊는다.
--   4) 악의 판단(본인 정의) — 같은 인증(같은 미션·같은 날)이 운영자에게 3번 반려되면 의도한 것으로 보고 최종 반려:
--      더는 만회할 수 없다. 예: 3km·페이스 캡처 미션에 러닝머신 사진만 거듭 올림. 다른 날 같은 미션은 그대로 할 수 있다.
--      묶음 = makeup_root(첫 인증 id) 로 이어진 인증들. 반려 수는 그 묶음에서 센다.
--   5) 같은 반려에 만회는 하나(이미 다시 올렸으면 그 결과를 가리켜야 한다) — 동시에 여러 장 올려 심사를 흐리는 것 방지.
--   6) 알림 — 운영자: 「🔁 다시 올린 인증 · N번째」(3번째면 「이번에 반려하면 이 날짜 인증은 마감」).
--      참여자 반려 알림: 「24시간 안에 다시 올리면 원래 날로 인정돼요」 / 3번째면 「이 날짜 인증은 마감됐어요」.
--
--   반려된 사진을 그대로 다시 올리는 건 이미 막힌다 — 사진 지문 중복 금지(029, 상태와 무관).
--   종료·시작 전 프로그램은 기존 가드(190·239)가 그대로 막는다.
--
--   하위호환: 열 추가(NULL 허용) + 새 트리거(만회일 때만 동작) + 함수 3개 교체(만회가 아니면 기존과 같다 —
--     018 set_verification_status_on_insert / 111 notify_on_verification_submitted / 114 notify_on_verification_review 원문에
--     만회 분기만 더함). 화면이 배포되기 전엔 아무도 makeup_of 를 보내지 않는다 → 마이그 먼저 올려도 기존 동작 그대로.
--     단, 반려 알림 본문에 만회 안내 한 줄이 바로 붙는다(화면 배포 전에도) — 그 사이 다시 올리면 오늘 기록으로 들어가므로
--     이 마이그와 화면은 «같은 날» 내보낸다. [[feedback_deploy_safety]]
--
-- 복구: supabase/rollbacks/283_revert_verification_makeup.sql
-- ============================================================

-- ─── 1) 열 ───────────────────────────────────────────────
ALTER TABLE public.verifications
  ADD COLUMN IF NOT EXISTS makeup_of UUID REFERENCES public.verifications(id) ON DELETE SET NULL;
ALTER TABLE public.verifications
  ADD COLUMN IF NOT EXISTS makeup_root UUID;
ALTER TABLE public.verifications
  ADD COLUMN IF NOT EXISTS makeup_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_verifications_makeup_of
  ON public.verifications (makeup_of) WHERE makeup_of IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_verifications_makeup_root
  ON public.verifications (makeup_root) WHERE makeup_root IS NOT NULL;


-- ─── 2) 만회 검증·날짜 맞춤 ──────────────────────────────
--   하루 한도 트리거(enforce_daily_limit_before_verification_insert)보다 «먼저» 돌아야 원래 날로 센다.
--   같은 시점(BEFORE INSERT) 트리거는 이름 알파벳순으로 돈다 → 이름을 a_ 로 시작.
--   UPDATE 때는 만회 열을 못 바꾸게 고정(만회 묶음을 사후에 조작하지 못하게).
CREATE OR REPLACE FUNCTION public.verification_makeup_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_prev    public.verifications%ROWTYPE;
  v_root    UUID;
  v_rejects INT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.makeup_of   := OLD.makeup_of;
    NEW.makeup_root := OLD.makeup_root;
    NEW.makeup_at   := OLD.makeup_at;
    RETURN NEW;
  END IF;

  IF NEW.makeup_of IS NULL THEN
    -- 만회가 아닌 인증은 만회 열을 가질 수 없다(클라가 임의로 넣지 못하게)
    NEW.makeup_root := NULL;
    NEW.makeup_at   := NULL;
    RETURN NEW;
  END IF;

  SELECT * INTO v_prev FROM public.verifications WHERE id = NEW.makeup_of;
  IF NOT FOUND
     OR v_prev.user_id <> NEW.user_id
     OR v_prev.mission_id <> NEW.mission_id
     OR v_prev.status <> 'REJECTED'
     OR v_prev.reviewed_at IS NULL THEN
    RAISE EXCEPTION 'MAKEUP_INVALID' USING ERRCODE = 'P0001', HINT = 'makeup';
  END IF;

  IF now() > v_prev.reviewed_at + interval '24 hours' THEN
    RAISE EXCEPTION 'MAKEUP_EXPIRED' USING ERRCODE = 'P0001', HINT = 'makeup';
  END IF;

  IF EXISTS (SELECT 1 FROM public.verifications o WHERE o.makeup_of = v_prev.id) THEN
    RAISE EXCEPTION 'MAKEUP_DUPLICATE' USING ERRCODE = 'P0001', HINT = 'makeup';
  END IF;

  v_root := COALESCE(v_prev.makeup_root, v_prev.id);
  SELECT count(*) INTO v_rejects
  FROM public.verifications o
  WHERE (o.id = v_root OR o.makeup_root = v_root)
    AND o.status = 'REJECTED';
  IF v_rejects >= 3 THEN
    RAISE EXCEPTION 'MAKEUP_LIMIT' USING ERRCODE = 'P0001', HINT = 'makeup';
  END IF;

  NEW.makeup_root  := v_root;
  NEW.makeup_at    := now();
  NEW.submitted_at := v_prev.submitted_at;   -- 원래 날로 — 하루 한도·점수·집계가 모두 이 시각을 본다
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS a_verification_makeup_guard ON public.verifications;
CREATE TRIGGER a_verification_makeup_guard
  BEFORE INSERT OR UPDATE ON public.verifications
  FOR EACH ROW EXECUTE FUNCTION public.verification_makeup_guard();


-- ─── 3) 만회는 늘 운영자 심사 (018 원문 + 만회 분기) ──────────────
CREATE OR REPLACE FUNCTION public.set_verification_status_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verification_type TEXT;
BEGIN
  -- 만회(283)는 미션 방식과 무관하게 운영자 심사 — 자동 승인 악용 뒤 다시 자동 승인되는 고리를 끊는다
  IF NEW.makeup_of IS NOT NULL THEN
    NEW.status := 'PENDING_REVIEW';
    NEW.reviewed_at := NULL;
    RETURN NEW;
  END IF;

  SELECT verification_type
  INTO v_verification_type
  FROM public.missions
  WHERE id = NEW.mission_id;

  IF v_verification_type = 'AUTO' THEN
    NEW.status := 'APPROVED';
    NEW.reviewed_at := NOW();
  ELSIF v_verification_type = 'MANUAL' THEN
    NEW.status := 'PENDING_REVIEW';
  END IF;

  RETURN NEW;
END;
$$;


-- ─── 4) 운영자 알림 — 다시 올린 인증 · N번째 (111 원문 + 만회 분기) ──────
CREATE OR REPLACE FUNCTION public.notify_on_verification_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_program_id UUID;
  v_program_name TEXT;
  v_mission_title TEXT;
  v_actor_nickname TEXT;
  v_title TEXT;
  v_body TEXT;
  v_link_path TEXT;
  v_attempt INT;
BEGIN
  SELECT m.title, m.program_id, p.name, p.owner_id
  INTO v_mission_title, v_program_id, v_program_name, v_owner_id
  FROM public.missions m
  JOIN public.programs p ON p.id = m.program_id
  WHERE m.id = NEW.mission_id;

  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_notification_enabled(v_owner_id, 'VERIFICATION_SUBMITTED') THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;

  IF NEW.status = 'PENDING_REVIEW' AND NEW.makeup_of IS NOT NULL THEN
    -- 만회 — 몇 번째 시도인지(지금까지 반려 수 + 1). 3번째면 «이번 반려가 마지막»임을 운영자에게 알린다
    SELECT count(*) + 1 INTO v_attempt
    FROM public.verifications o
    WHERE (o.id = NEW.makeup_root OR o.makeup_root = NEW.makeup_root)
      AND o.status = 'REJECTED';
    v_title := '🔁 다시 올린 인증';
    v_body := COALESCE(v_actor_nickname, '(?)') || '님 — ' || v_mission_title || ' · ' || v_attempt || '번째 (' || v_program_name || ')'
      || CASE WHEN v_attempt >= 3 THEN E'\n이번에 반려하면 이 날짜 인증은 마감돼요' ELSE '' END;
    v_link_path := '/programs/' || v_program_id::text || '?vreview=1';
  ELSIF NEW.status = 'PENDING_REVIEW' THEN
    v_title := '📝 심사 요청';
    v_body := COALESCE(v_actor_nickname, '(?)') || '님 — ' || v_mission_title || ' (' || v_program_name || ')';
    v_link_path := '/programs/' || v_program_id::text || '?vreview=1';
  ELSE
    v_title := '🌱 새 인증';
    v_body := COALESCE(v_actor_nickname, '(?)') || '님 — ' || v_mission_title || ' (' || v_program_name || ')';
    v_link_path := '/programs/' || v_program_id::text || '/feed?v=' || NEW.id::text;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_owner_id,
    'VERIFICATION_SUBMITTED',
    v_title,
    v_body,
    v_link_path,
    NEW.user_id,
    'verifications',
    NEW.id
  );

  RETURN NEW;
END;
$$;


-- ─── 5) 참여자 반려 알림 — 만회 안내 한 줄 (114 원문 + 안내) ───────────
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
  v_feed_enabled BOOLEAN;
  v_link TEXT;
  v_rejects INT;
BEGIN
  IF OLD.status != 'PENDING_REVIEW' THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('APPROVED', 'REJECTED') THEN RETURN NEW; END IF;

  v_type := CASE NEW.status WHEN 'APPROVED' THEN 'REVIEW_APPROVED' ELSE 'REVIEW_REJECTED' END;
  IF NOT public.is_notification_enabled(NEW.user_id, v_type) THEN RETURN NEW; END IF;

  SELECT m.title, m.program_id, m.point, p.name, p.feed_enabled
  INTO v_mission_title, v_program_id, v_point, v_program_name, v_feed_enabled
  FROM public.missions m
  JOIN public.programs p ON p.id = m.program_id
  WHERE m.id = NEW.mission_id;

  IF NEW.status = 'APPROVED' THEN
    v_link := CASE
      WHEN v_feed_enabled THEN '/programs/' || v_program_id::text || '/feed?v=' || NEW.id::text
      ELSE '/programs/' || v_program_id::text
    END;
    INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
    VALUES (
      NEW.user_id,
      'REVIEW_APPROVED',
      '✅ 인증이 승인됐어요',
      v_mission_title || ' — +' || v_point || 'P 획득 (' || v_program_name || ')',
      v_link,
      'verifications',
      NEW.id
    );
  ELSIF NEW.status = 'REJECTED' THEN
    -- 만회 안내(283) — 이 반려까지 묶음의 반려 수. 3번째면 마감, 아니면 24시간 안 만회
    SELECT count(*) INTO v_rejects
    FROM public.verifications o
    WHERE (o.id = COALESCE(NEW.makeup_root, NEW.id) OR o.makeup_root = COALESCE(NEW.makeup_root, NEW.id))
      AND (o.status = 'REJECTED' OR o.id = NEW.id);
    INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
    VALUES (
      NEW.user_id,
      'REVIEW_REJECTED',
      '❌ 인증이 반려됐어요',
      v_program_name || E'\n' || v_mission_title
        || CASE WHEN btrim(COALESCE(NEW.rejection_reason, '')) <> '' THEN E'\n사유: ' || NEW.rejection_reason ELSE '' END
        || CASE WHEN v_rejects >= 3
             THEN E'\n같은 인증이 3번 반려돼 이 날짜 인증은 마감됐어요.'
             ELSE E'\n24시간 안에 다시 올리면 원래 날로 인정돼요.' END,
      '/programs/' || v_program_id::text,
      'verifications',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;
