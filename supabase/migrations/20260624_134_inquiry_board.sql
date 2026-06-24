-- ============================================================
-- Migration: 134 - 전역 1:1 문의 게시판 (inquiries / inquiry_comments)
-- 작성일: 2026-06-24
-- 설명:
--   운영자·참가자가 서비스 관리자(role='ADMIN')에게 직접 문의하는 전역 게시판.
--   프로그램과 무관(program_id 없음). 관리자 답변은 댓글 스레드로 주고받음.
--
--   공개/비공개:
--     - 공개(is_private=false): 모든 로그인 사용자가 열람.
--     - 비공개(is_private=true): 작성자 + 관리자만 열람(RLS). 작성 시 비밀번호 설정,
--       작성자가 열람할 때 비번 입력(관리자는 통과). 비번은 pgcrypto 로 해싱 저장.
--
--   상태: open(답변대기) → answered(관리자 댓글 시 자동) / closed(보관).
--   알림: 새 문의/작성자 답글 → 관리자들, 관리자 답글 → 작성자.
--
--   추가만(하위호환). is_admin()(003) 재사용.
-- 복구:
--   DROP TABLE public.inquiry_comments, public.inquiries CASCADE;
--   DROP FUNCTION public.create_inquiry(TEXT,TEXT,BOOLEAN,TEXT);
--   DROP FUNCTION public.check_inquiry_password(UUID,TEXT);
--   관련 트리거 함수 DROP. (type CHECK 는 INQUIRY_* 알림행 정리 후 되돌림)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ─── 1) 테이블 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT false,
  password_hash TEXT,                              -- 비공개일 때만
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'answered', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inquiries_author ON public.inquiries(author_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON public.inquiries(created_at DESC);

CREATE TABLE IF NOT EXISTS public.inquiry_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  is_admin BOOLEAN NOT NULL DEFAULT false,         -- 작성 시점 관리자 여부(표시·로직용)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inquiry_comments_inquiry
  ON public.inquiry_comments(inquiry_id, created_at);

-- ─── 2) RLS ──────────────────────────────────────────────────
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- 읽기: 작성자 / 관리자 / 공개글은 모두
DROP POLICY IF EXISTS "inquiries select" ON public.inquiries;
CREATE POLICY "inquiries select" ON public.inquiries
FOR SELECT TO authenticated
USING (author_id = auth.uid() OR public.is_admin() OR is_private = false);

-- 작성: 본인 글 (실제 작성은 create_inquiry RPC 로 — 비번 해싱)
DROP POLICY IF EXISTS "inquiries insert" ON public.inquiries;
CREATE POLICY "inquiries insert" ON public.inquiries
FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid());

-- 수정: 작성자(본문) / 관리자(상태 등)
DROP POLICY IF EXISTS "inquiries update" ON public.inquiries;
CREATE POLICY "inquiries update" ON public.inquiries
FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR public.is_admin())
WITH CHECK (author_id = auth.uid() OR public.is_admin());

-- 삭제: 작성자 / 관리자
DROP POLICY IF EXISTS "inquiries delete" ON public.inquiries;
CREATE POLICY "inquiries delete" ON public.inquiries
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.is_admin());

ALTER TABLE public.inquiry_comments ENABLE ROW LEVEL SECURITY;

-- 읽기: 그 문의를 볼 수 있는 사람이면
DROP POLICY IF EXISTS "inquiry_comments select" ON public.inquiry_comments;
CREATE POLICY "inquiry_comments select" ON public.inquiry_comments
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.inquiries i
  WHERE i.id = inquiry_id
    AND (i.author_id = auth.uid() OR public.is_admin() OR i.is_private = false)
));

-- 작성: 본인 댓글 + (문의 작성자 본인 또는 관리자) — 작성자↔관리자 대화
DROP POLICY IF EXISTS "inquiry_comments insert" ON public.inquiry_comments;
CREATE POLICY "inquiry_comments insert" ON public.inquiry_comments
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.inquiries i
    WHERE i.id = inquiry_id AND (i.author_id = auth.uid() OR public.is_admin())
  )
);

-- 삭제: 본인 댓글 / 관리자
DROP POLICY IF EXISTS "inquiry_comments delete" ON public.inquiry_comments;
CREATE POLICY "inquiry_comments delete" ON public.inquiry_comments
FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

-- ─── 3) 알림 타입 확장 ──────────────────────────────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'REVIEW_APPROVED', 'REVIEW_REJECTED', 'POST_LIKE', 'POST_COMMENT',
    'PARTICIPANT_JOINED', 'VERIFICATION_SUBMITTED', 'POST_PENDING',
    'POST_APPROVED', 'POST_REJECTED', 'REPORT_RECEIVED',
    'TEAM_INVITE', 'TEAM_JOINED', 'TEAM_REMOVED', 'TEAM_LEADER_CHANGED',
    'INQUIRY_RECEIVED', 'INQUIRY_ANSWERED'
  ));

-- ─── 4) 문의 작성 RPC (비번 해싱) ───────────────────────────
CREATE OR REPLACE FUNCTION public.create_inquiry(
  p_title TEXT,
  p_body TEXT,
  p_is_private BOOLEAN,
  p_password TEXT
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '로그인이 필요해요'; END IF;
  IF v_title = '' THEN RAISE EXCEPTION '제목을 입력해주세요'; END IF;
  IF char_length(v_title) > 100 THEN RAISE EXCEPTION '제목은 최대 100자예요'; END IF;
  IF v_body = '' THEN RAISE EXCEPTION '내용을 입력해주세요'; END IF;

  IF COALESCE(p_is_private, false) THEN
    IF btrim(COALESCE(p_password, '')) = '' THEN
      RAISE EXCEPTION '비공개 글은 비밀번호가 필요해요';
    END IF;
    v_hash := crypt(p_password, gen_salt('bf'));
  END IF;

  INSERT INTO public.inquiries (author_id, title, body, is_private, password_hash)
  VALUES (v_uid, v_title, v_body, COALESCE(p_is_private, false), v_hash)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_inquiry(TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;

-- ─── 5) 비번 확인 RPC (관리자는 통과) ───────────────────────
CREATE OR REPLACE FUNCTION public.check_inquiry_password(
  p_id UUID,
  p_password TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT CASE
    WHEN public.is_admin() THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.inquiries
      WHERE id = p_id
        AND password_hash IS NOT NULL
        AND password_hash = crypt(COALESCE(p_password, ''), password_hash)
    )
  END;
$$;
GRANT EXECUTE ON FUNCTION public.check_inquiry_password(UUID, TEXT) TO authenticated;

-- ─── 6) 새 문의 → 관리자들에게 알림 ─────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_on_inquiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author TEXT;
BEGIN
  SELECT nickname INTO v_author FROM public.users WHERE id = NEW.author_id;
  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  SELECT u.id, 'INQUIRY_RECEIVED', '📩 새 문의가 도착했어요',
    COALESCE(v_author, '사용자') || '님: ' || LEFT(NEW.title, 40),
    '/support?tab=inquiry&inquiry=' || NEW.id,
    NEW.author_id, 'inquiries', NEW.id
  FROM public.users u
  WHERE u.role = 'ADMIN' AND u.id <> NEW.author_id
    AND public.is_notification_enabled(u.id, 'INQUIRY_RECEIVED');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_admins_inquiry ON public.inquiries;
CREATE TRIGGER notify_admins_inquiry
  AFTER INSERT ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_inquiry();

-- ─── 7) 댓글 작성 시점 관리자 여부 기록 ─────────────────────
CREATE OR REPLACE FUNCTION public.inquiry_comment_set_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.is_admin := public.is_admin();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS inquiry_comment_admin ON public.inquiry_comments;
CREATE TRIGGER inquiry_comment_admin
  BEFORE INSERT ON public.inquiry_comments
  FOR EACH ROW EXECUTE FUNCTION public.inquiry_comment_set_admin();

-- ─── 8) 댓글 → 상태 갱신 + 상대방 알림 ──────────────────────
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
BEGIN
  SELECT author_id, title INTO v_author, v_title
  FROM public.inquiries WHERE id = NEW.inquiry_id;
  IF v_author IS NULL THEN RETURN NEW; END IF;

  SELECT nickname INTO v_actor FROM public.users WHERE id = NEW.user_id;

  IF NEW.is_admin THEN
    -- 관리자 답변 → 상태 answered + 작성자에게 알림
    UPDATE public.inquiries SET status = 'answered', updated_at = now()
    WHERE id = NEW.inquiry_id AND status <> 'closed';

    IF v_author <> NEW.user_id
       AND public.is_notification_enabled(v_author, 'INQUIRY_ANSWERED') THEN
      INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
      VALUES (
        v_author, 'INQUIRY_ANSWERED', '💬 문의에 답변이 달렸어요',
        LEFT(v_title, 40) || ' — ' || LEFT(NEW.body, 50),
        '/support?tab=inquiry&inquiry=' || NEW.inquiry_id,
        NEW.user_id, 'inquiry_comments', NEW.id
      );
    END IF;
  ELSE
    -- 작성자(비관리자) 답글 → 관리자들에게 알림
    INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
    SELECT u.id, 'INQUIRY_RECEIVED', '📩 문의에 새 답글이 있어요',
      COALESCE(v_actor, '사용자') || ': ' || LEFT(NEW.body, 50),
      '/support?tab=inquiry&inquiry=' || NEW.inquiry_id,
      NEW.user_id, 'inquiry_comments', NEW.id
    FROM public.users u
    WHERE u.role = 'ADMIN' AND u.id <> NEW.user_id
      AND public.is_notification_enabled(u.id, 'INQUIRY_RECEIVED');
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_inquiry_comment ON public.inquiry_comments;
CREATE TRIGGER notify_inquiry_comment
  AFTER INSERT ON public.inquiry_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_inquiry_comment();
