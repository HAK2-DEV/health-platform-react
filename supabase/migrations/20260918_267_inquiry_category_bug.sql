-- ============================================================
-- Migration: 267 - 문의 게시판에 「버그 신고」 분류 추가
-- 작성일: 2026-09-18
-- 설명:
--   고객센터를 FAQ / 버그 신고 / 1:1 문의 3개 탭으로 나누기 위해
--   inquiries 에 category('general' | 'bug') 를 추가한다.
--   테이블·RLS·댓글 스레드·비번 게이트는 «기존 것을 그대로» 쓴다(추가만).
--
--   · 기존 행은 전부 'general'(DEFAULT) → 1:1 문의 탭에 지금처럼 보인다.
--   · create_inquiry 는 p_category 를 «기본값 있는» 5번째 인자로 받는다.
--     기존 4인자 호출(아직 배포 안 된 PWA·앱)도 그대로 동작하므로
--     이 마이그레이션을 «먼저» 올려도 안전하다. [[feedback_deploy_safety]]
--   · ⚠️ 알림 딥링크의 link_path 를 분류에 맞는 탭으로 분기한다.
--     버그 신고 알림을 tab=inquiry 로 보내면 그 탭 목록은 category='general'
--     로 걸러져 있어 «글을 못 찾아» 상세가 안 열린다.
--   · ⚠️ 새 컬럼에는 GRANT 를 명시한다. authenticated 에 컬럼 단위 권한이
--     걸려 있으면 새 컬럼이 빠져 그 컬럼을 고르는 쿼리가 통째로 42501 로
--     죽는다(266 에서 agreed_health_at 으로 겪음). 테이블 단위 권한이면
--     이 GRANT 는 부분집합이라 무해하다.
--
-- 복구: supabase/rollbacks/267_revert_inquiry_category.sql
-- ============================================================

-- ─── 1) 분류 컬럼 ───────────────────────────────────────────
ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_category_check;
ALTER TABLE public.inquiries ADD CONSTRAINT inquiries_category_check
  CHECK (category IN ('general', 'bug'));

GRANT SELECT(category), INSERT(category), UPDATE(category)
  ON public.inquiries TO authenticated;

-- 탭별 목록은 category 로 걸러 최신순 정렬한다.
CREATE INDEX IF NOT EXISTS idx_inquiries_category_created
  ON public.inquiries(category, created_at DESC);

-- ─── 2) 작성 RPC — p_category 추가 (기본값 있어 4인자 호출 호환) ──
--   시그니처가 바뀌므로 CREATE OR REPLACE 로는 안 되고 교체해야 한다.
--   둘을 함께 두면 PostgREST 가 4인자 호출에서 오버로드를 못 고른다.
DROP FUNCTION IF EXISTS public.create_inquiry(TEXT, TEXT, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.create_inquiry(
  p_title TEXT,
  p_body TEXT,
  p_is_private BOOLEAN,
  p_password TEXT,
  p_category TEXT DEFAULT 'general'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
  v_hash TEXT;
  v_title TEXT := btrim(COALESCE(p_title, ''));
  v_body TEXT := btrim(COALESCE(p_body, ''));
  v_category TEXT := COALESCE(NULLIF(btrim(COALESCE(p_category, '')), ''), 'general');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '로그인이 필요해요'; END IF;
  IF v_title = '' THEN RAISE EXCEPTION '제목을 입력해주세요'; END IF;
  IF char_length(v_title) > 100 THEN RAISE EXCEPTION '제목은 최대 100자예요'; END IF;
  IF v_body = '' THEN RAISE EXCEPTION '내용을 입력해주세요'; END IF;
  -- 버그 신고는 기기 정보가 자동으로 붙어 본문이 길다. 실제 글보다 훨씬 넉넉히 잡되
  -- 무한정 들어오는 것만 막는다.
  IF char_length(v_body) > 20000 THEN RAISE EXCEPTION '내용이 너무 길어요'; END IF;
  IF v_category NOT IN ('general', 'bug') THEN v_category := 'general'; END IF;

  IF COALESCE(p_is_private, false) THEN
    IF btrim(COALESCE(p_password, '')) = '' THEN
      RAISE EXCEPTION '비공개 글은 비밀번호가 필요해요';
    END IF;
    v_hash := crypt(p_password, gen_salt('bf'));
  END IF;

  INSERT INTO public.inquiries (author_id, title, body, is_private, password_hash, category)
  VALUES (v_uid, v_title, v_body, COALESCE(p_is_private, false), v_hash, v_category)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_inquiry(TEXT, TEXT, BOOLEAN, TEXT, TEXT) TO authenticated;

-- ─── 3) 새 글 알림 — 분류별 문구 + 해당 탭으로 딥링크 ───────
CREATE OR REPLACE FUNCTION public.notify_admins_on_inquiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author TEXT;
  v_bug BOOLEAN := (COALESCE(NEW.category, 'general') = 'bug');
  v_title TEXT;
  v_tab TEXT;
BEGIN
  SELECT nickname INTO v_author FROM public.users WHERE id = NEW.author_id;
  v_title := CASE WHEN v_bug THEN '🐞 버그 신고가 접수됐어요' ELSE '📩 새 문의가 도착했어요' END;
  v_tab   := CASE WHEN v_bug THEN 'bug' ELSE 'inquiry' END;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  SELECT u.id, 'INQUIRY_RECEIVED', v_title,
    COALESCE(v_author, '사용자') || '님: ' || LEFT(NEW.title, 40),
    '/support?tab=' || v_tab || '&inquiry=' || NEW.id,
    NEW.author_id, 'inquiries', NEW.id
  FROM public.users u
  WHERE u.role = 'ADMIN' AND u.id <> NEW.author_id
    AND public.is_notification_enabled(u.id, 'INQUIRY_RECEIVED');
  RETURN NEW;
END;
$$;

-- ─── 4) 댓글 알림 — 같은 이유로 탭 분기 ─────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_inquiry_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author UUID;
  v_title TEXT;
  v_actor TEXT;
  v_category TEXT;
  v_tab TEXT;
  v_link TEXT;
BEGIN
  SELECT author_id, title, COALESCE(category, 'general')
    INTO v_author, v_title, v_category
  FROM public.inquiries WHERE id = NEW.inquiry_id;
  IF v_author IS NULL THEN RETURN NEW; END IF;

  SELECT nickname INTO v_actor FROM public.users WHERE id = NEW.user_id;
  v_tab  := CASE WHEN v_category = 'bug' THEN 'bug' ELSE 'inquiry' END;
  v_link := '/support?tab=' || v_tab || '&inquiry=' || NEW.inquiry_id;

  IF NEW.is_admin THEN
    -- 관리자 답변 → 상태 answered + 작성자에게 알림
    UPDATE public.inquiries SET status = 'answered', updated_at = now()
    WHERE id = NEW.inquiry_id AND status <> 'closed';

    IF v_author <> NEW.user_id
       AND public.is_notification_enabled(v_author, 'INQUIRY_ANSWERED') THEN
      INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
      VALUES (
        v_author, 'INQUIRY_ANSWERED',
        CASE WHEN v_category = 'bug' THEN '🐞 신고하신 버그에 답변이 달렸어요'
             ELSE '💬 문의에 답변이 달렸어요' END,
        LEFT(v_title, 40) || ' — ' || LEFT(NEW.body, 50),
        v_link, NEW.user_id, 'inquiry_comments', NEW.id
      );
    END IF;
  ELSE
    -- 작성자(비관리자) 답글 → 관리자들에게 알림
    INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
    SELECT u.id, 'INQUIRY_RECEIVED',
      CASE WHEN v_category = 'bug' THEN '🐞 버그 신고에 새 답글이 있어요'
           ELSE '📩 문의에 새 답글이 있어요' END,
      COALESCE(v_actor, '사용자') || ': ' || LEFT(NEW.body, 50),
      v_link, NEW.user_id, 'inquiry_comments', NEW.id
    FROM public.users u
    WHERE u.role = 'ADMIN' AND u.id <> NEW.user_id
      AND public.is_notification_enabled(u.id, 'INQUIRY_RECEIVED');
  END IF;

  RETURN NEW;
END;
$$;
