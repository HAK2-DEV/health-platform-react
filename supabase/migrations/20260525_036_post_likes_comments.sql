-- ============================================================
-- Migration: 036 - post_likes + post_comments 테이블 (커뮤니티 피드)
-- 작성일: 2026-05-25
-- 설명: 게시판형 인스타 피드 — 참여자가 다른 참여자의 인증에 좋아요/댓글.
--   "게시물" = 기존 verifications 의 행 (사진/숫자/소감). 별도 posts 테이블 X.
--   feed_enabled=true 인 프로그램에 한해 활성 (037 RLS 와 조합).
--
-- post_likes:
--   (verification_id, user_id) UNIQUE — 한 인증에 한 유저 1좋아요
-- post_comments:
--   content TEXT — 본문 (200자 제한, CHECK)
--
-- RLS: 같은 프로그램 ACTIVE 참여자만 SELECT/INSERT.
--   본인의 좋아요만 DELETE (취소). 본인의 댓글만 UPDATE/DELETE + 운영자 DELETE.
--
-- 복구:
--   supabase/rollbacks/036_revert_post_likes_comments.sql 수동 실행.
-- ============================================================

-- ─── post_likes ──────────────────────────────────────────
CREATE TABLE public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL REFERENCES public.verifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (verification_id, user_id)
);

CREATE INDEX idx_post_likes_verification ON public.post_likes(verification_id);
CREATE INDEX idx_post_likes_user ON public.post_likes(user_id);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- SELECT: 같은 feed_enabled 프로그램의 ACTIVE 참여자만
CREATE POLICY "view likes of feed-enabled program"
ON public.post_likes
FOR SELECT
TO authenticated
USING (
  verification_id IN (
    SELECT v.id FROM public.verifications v
    JOIN public.missions m ON m.id = v.mission_id
    JOIN public.programs p ON p.id = m.program_id
    JOIN public.program_participants pp ON pp.program_id = p.id
    WHERE p.feed_enabled = true
      AND pp.user_id = auth.uid()
      AND pp.status = 'ACTIVE'
  )
);

-- INSERT: 본인만, 같은 feed_enabled 프로그램의 ACTIVE 참여자
CREATE POLICY "insert own like on feed-enabled program"
ON public.post_likes
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND verification_id IN (
    SELECT v.id FROM public.verifications v
    JOIN public.missions m ON m.id = v.mission_id
    JOIN public.programs p ON p.id = m.program_id
    JOIN public.program_participants pp ON pp.program_id = p.id
    WHERE p.feed_enabled = true
      AND pp.user_id = auth.uid()
      AND pp.status = 'ACTIVE'
  )
);

-- DELETE: 본인만 (좋아요 취소)
CREATE POLICY "delete own like"
ON public.post_likes
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ADMIN
CREATE POLICY "admins can do anything on post_likes"
ON public.post_likes
FOR ALL
TO authenticated
USING (public.is_admin());


-- ─── post_comments ───────────────────────────────────────
CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL REFERENCES public.verifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_comments_verification ON public.post_comments(verification_id);
CREATE INDEX idx_post_comments_user ON public.post_comments(user_id);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: 같은 feed_enabled 프로그램의 ACTIVE 참여자
CREATE POLICY "view comments of feed-enabled program"
ON public.post_comments
FOR SELECT
TO authenticated
USING (
  verification_id IN (
    SELECT v.id FROM public.verifications v
    JOIN public.missions m ON m.id = v.mission_id
    JOIN public.programs p ON p.id = m.program_id
    JOIN public.program_participants pp ON pp.program_id = p.id
    WHERE p.feed_enabled = true
      AND pp.user_id = auth.uid()
      AND pp.status = 'ACTIVE'
  )
);

-- INSERT: 본인만, 같은 feed_enabled 프로그램의 ACTIVE 참여자
CREATE POLICY "insert own comment on feed-enabled program"
ON public.post_comments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND verification_id IN (
    SELECT v.id FROM public.verifications v
    JOIN public.missions m ON m.id = v.mission_id
    JOIN public.programs p ON p.id = m.program_id
    JOIN public.program_participants pp ON pp.program_id = p.id
    WHERE p.feed_enabled = true
      AND pp.user_id = auth.uid()
      AND pp.status = 'ACTIVE'
  )
);

-- UPDATE: 본인 댓글만 (편집)
CREATE POLICY "update own comment"
ON public.post_comments
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- DELETE: 본인 OR 프로그램 운영자 (관리 차원)
CREATE POLICY "delete own comment or owner"
ON public.post_comments
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR verification_id IN (
    SELECT v.id FROM public.verifications v
    JOIN public.missions m ON m.id = v.mission_id
    JOIN public.programs p ON p.id = m.program_id
    WHERE p.owner_id = auth.uid()
  )
);

-- ADMIN
CREATE POLICY "admins can do anything on post_comments"
ON public.post_comments
FOR ALL
TO authenticated
USING (public.is_admin());
