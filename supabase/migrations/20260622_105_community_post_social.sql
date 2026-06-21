-- ============================================================
-- Migration: 105 - 커뮤니티 게시판 글 좋아요/댓글 (community_post_likes / _comments)
-- 작성일: 2026-06-22
-- 설명:
--   community_posts(096) 게시판 글에 좋아요·댓글 추가. (기존 post_likes/post_comments 는
--   verifications 인증 피드 전용이라 별도 테이블로 신설)
--   권한(RLS): 같은 프로그램의 ACTIVE 참여자 또는 운영자만 조회/작성.
--     - 좋아요: (post_id, user_id) UNIQUE, 본인만 취소(DELETE)
--     - 댓글: content 1~500자, 본인 수정/삭제 + 운영자 삭제
--   ※ 「반응 허용(reactionAuto)」·게시판 commentPerm(readonly) 은 클라이언트 UI 게이트.
--      RLS 는 멤버십(참여자/운영자)만 강제.
--   하위호환: 신규 테이블만 추가. 기존 코드/데이터 영향 없음.
--   단, pinned_at(104)처럼 조회하는 새 코드가 동작하려면 이 마이그레이션을 프로드에 먼저 적용.
--
-- 복구:
--   DROP TABLE IF EXISTS public.community_post_comments;
--   DROP TABLE IF EXISTS public.community_post_likes;
-- ============================================================

-- ─── 1) community_post_likes ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_cpl_post ON public.community_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_cpl_user ON public.community_post_likes(user_id);

ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;

-- 멤버십(운영자 OR 같은 프로그램 ACTIVE 참여자) — 글 기준
DROP POLICY IF EXISTS "cpl select" ON public.community_post_likes;
CREATE POLICY "cpl select" ON public.community_post_likes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.community_posts cp
    WHERE cp.id = post_id AND (
      EXISTS (SELECT 1 FROM public.programs p WHERE p.id = cp.program_id AND p.owner_id = auth.uid())
      OR public._is_active_participant(cp.program_id, auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "cpl insert" ON public.community_post_likes;
CREATE POLICY "cpl insert" ON public.community_post_likes
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.community_posts cp
    WHERE cp.id = post_id AND (
      EXISTS (SELECT 1 FROM public.programs p WHERE p.id = cp.program_id AND p.owner_id = auth.uid())
      OR public._is_active_participant(cp.program_id, auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "cpl delete own" ON public.community_post_likes;
CREATE POLICY "cpl delete own" ON public.community_post_likes
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- ─── 2) community_post_comments ──────────────────────────
CREATE TABLE IF NOT EXISTS public.community_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cpc_post ON public.community_post_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cpc_user ON public.community_post_comments(user_id);

ALTER TABLE public.community_post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cpc select" ON public.community_post_comments;
CREATE POLICY "cpc select" ON public.community_post_comments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.community_posts cp
    WHERE cp.id = post_id AND (
      EXISTS (SELECT 1 FROM public.programs p WHERE p.id = cp.program_id AND p.owner_id = auth.uid())
      OR public._is_active_participant(cp.program_id, auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "cpc insert" ON public.community_post_comments;
CREATE POLICY "cpc insert" ON public.community_post_comments
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.community_posts cp
    WHERE cp.id = post_id AND (
      EXISTS (SELECT 1 FROM public.programs p WHERE p.id = cp.program_id AND p.owner_id = auth.uid())
      OR public._is_active_participant(cp.program_id, auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "cpc update own" ON public.community_post_comments;
CREATE POLICY "cpc update own" ON public.community_post_comments
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "cpc delete own or owner" ON public.community_post_comments;
CREATE POLICY "cpc delete own or owner" ON public.community_post_comments
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.community_posts cp
    JOIN public.programs p ON p.id = cp.program_id
    WHERE cp.id = post_id AND p.owner_id = auth.uid()
  )
);
