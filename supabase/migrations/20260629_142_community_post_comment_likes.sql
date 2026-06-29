-- ============================================================
-- Migration: 142 - community_post_comment_likes (게시판 댓글 좋아요)
-- 작성일: 2026-06-29
-- 설명: 커뮤니티 게시판 글 댓글(community_post_comments, 답글 parent_id 포함)에 좋아요.
--   141(인증 댓글 좋아요)과 짝 — 모든 종류 댓글에 좋아요.
--   (comment_id, user_id) UNIQUE. RLS: 105 패턴 — 해당 글 프로그램의 운영자/ACTIVE 참여자.
--
-- 영향: 신규 테이블 1개. 기존 동작 불변.
--
-- 복구:
--   DROP TABLE IF EXISTS public.community_post_comment_likes;
-- ============================================================

CREATE TABLE IF NOT EXISTS public.community_post_comment_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.community_post_comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cpcl_comment ON public.community_post_comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_cpcl_user ON public.community_post_comment_likes(user_id);

ALTER TABLE public.community_post_comment_likes ENABLE ROW LEVEL SECURITY;

-- 댓글이 속한 글의 프로그램 운영자 또는 ACTIVE 참여자만
DROP POLICY IF EXISTS "cpcl select" ON public.community_post_comment_likes;
CREATE POLICY "cpcl select" ON public.community_post_comment_likes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.community_post_comments c
    JOIN public.community_posts cp ON cp.id = c.post_id
    WHERE c.id = comment_id AND (
      EXISTS (SELECT 1 FROM public.programs p WHERE p.id = cp.program_id AND p.owner_id = auth.uid())
      OR public._is_active_participant(cp.program_id, auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "cpcl insert own" ON public.community_post_comment_likes;
CREATE POLICY "cpcl insert own" ON public.community_post_comment_likes
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.community_post_comments c
    JOIN public.community_posts cp ON cp.id = c.post_id
    WHERE c.id = comment_id AND (
      EXISTS (SELECT 1 FROM public.programs p WHERE p.id = cp.program_id AND p.owner_id = auth.uid())
      OR public._is_active_participant(cp.program_id, auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "cpcl delete own" ON public.community_post_comment_likes;
CREATE POLICY "cpcl delete own" ON public.community_post_comment_likes
FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "cpcl admins all" ON public.community_post_comment_likes;
CREATE POLICY "cpcl admins all" ON public.community_post_comment_likes
FOR ALL TO authenticated
USING (public.is_admin());
