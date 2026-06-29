-- ============================================================
-- Migration: 141 - post_comment_likes (인증 댓글 좋아요)
-- 작성일: 2026-06-29
-- 설명: 인증글 댓글(post_comments)에 좋아요. 금연 「응원」의 베스트 응원 기반.
--   (comment_id, user_id) UNIQUE — 한 댓글에 한 유저 1좋아요.
--   RLS: post_likes(036) 패턴 — 같은 feed_enabled 프로그램 ACTIVE 참여자만 SELECT/INSERT, 본인만 DELETE.
--
-- 영향: 신규 테이블 1개. 기존 동작 불변.
--
-- 복구:
--   DROP TABLE IF EXISTS public.post_comment_likes;
-- ============================================================

CREATE TABLE IF NOT EXISTS public.post_comment_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_comment_likes_comment ON public.post_comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_post_comment_likes_user ON public.post_comment_likes(user_id);

ALTER TABLE public.post_comment_likes ENABLE ROW LEVEL SECURITY;

-- 같은 댓글이 속한 feed_enabled 프로그램의 ACTIVE 참여자만 보이게/누르게
-- (comment → verification → mission → program → participant)
DROP POLICY IF EXISTS "view comment likes of feed program" ON public.post_comment_likes;
CREATE POLICY "view comment likes of feed program"
ON public.post_comment_likes FOR SELECT TO authenticated
USING (
  comment_id IN (
    SELECT c.id FROM public.post_comments c
    JOIN public.verifications v ON v.id = c.verification_id
    JOIN public.missions m ON m.id = v.mission_id
    JOIN public.programs p ON p.id = m.program_id
    JOIN public.program_participants pp ON pp.program_id = p.id
    WHERE p.feed_enabled = true AND pp.user_id = auth.uid() AND pp.status = 'ACTIVE'
  )
);

DROP POLICY IF EXISTS "insert own comment like" ON public.post_comment_likes;
CREATE POLICY "insert own comment like"
ON public.post_comment_likes FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND comment_id IN (
    SELECT c.id FROM public.post_comments c
    JOIN public.verifications v ON v.id = c.verification_id
    JOIN public.missions m ON m.id = v.mission_id
    JOIN public.programs p ON p.id = m.program_id
    JOIN public.program_participants pp ON pp.program_id = p.id
    WHERE p.feed_enabled = true AND pp.user_id = auth.uid() AND pp.status = 'ACTIVE'
  )
);

DROP POLICY IF EXISTS "delete own comment like" ON public.post_comment_likes;
CREATE POLICY "delete own comment like"
ON public.post_comment_likes FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins all on post_comment_likes" ON public.post_comment_likes;
CREATE POLICY "admins all on post_comment_likes"
ON public.post_comment_likes FOR ALL TO authenticated
USING (public.is_admin());
