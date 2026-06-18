-- ============================================================
-- Migration: 087 - 공개 프로그램 비참여자 열람(읽기) 허용
-- 작성일: 2026-06-18
-- 설명:
--   공개(is_public=true, status='PUBLISHED') + feed_enabled 프로그램은 비참여자도
--   "둘러보기"로 들어와 커뮤니티(피드)를 읽을 수 있어야 함 (보기 전용, 쓰기는 불가).
--
--   미션 SELECT 는 056 에서 이미 공개 허용됨. 랭킹은 get_program_ranking(SECURITY
--   DEFINER, 호출자 제한 없음)이라 이미 비참여자 호출 가능. 따라서 이 마이그레이션은
--   피드 3종(verifications/post_likes/post_comments)의 SELECT 만 공개 범위로 넓힌다.
--
--   기존 정책(자기 것/운영자/ACTIVE 참여자)은 그대로 두고, 추가 정책을 OR 로 더함
--   → 하위호환. INSERT/UPDATE/DELETE 는 변경 없음 (쓰기는 여전히 ACTIVE 참여자/운영자만).
--
--   노출 범위 가드: 반드시 is_public=true AND status='PUBLISHED' AND feed_enabled=true.
--   비공개 프로그램의 피드는 계속 잠김.
--
-- 복구: 아래 3개 정책 DROP.
--   DROP POLICY IF EXISTS "public viewer view approved verifications" ON public.verifications;
--   DROP POLICY IF EXISTS "public viewer view likes" ON public.post_likes;
--   DROP POLICY IF EXISTS "public viewer view comments" ON public.post_comments;
-- ============================================================

-- ─── verifications: 공개 프로그램의 APPROVED 인증 읽기 ───────────────
DROP POLICY IF EXISTS "public viewer view approved verifications" ON public.verifications;
CREATE POLICY "public viewer view approved verifications"
ON public.verifications
FOR SELECT
TO authenticated
USING (
  status = 'APPROVED'
  AND mission_id IN (
    SELECT m.id FROM public.missions m
    JOIN public.programs p ON p.id = m.program_id
    WHERE p.is_public = true
      AND p.status = 'PUBLISHED'
      AND p.feed_enabled = true
  )
);

-- ─── post_likes: 공개 프로그램 피드의 좋아요 읽기 ────────────────────
DROP POLICY IF EXISTS "public viewer view likes" ON public.post_likes;
CREATE POLICY "public viewer view likes"
ON public.post_likes
FOR SELECT
TO authenticated
USING (
  verification_id IN (
    SELECT v.id FROM public.verifications v
    JOIN public.missions m ON m.id = v.mission_id
    JOIN public.programs p ON p.id = m.program_id
    WHERE p.is_public = true
      AND p.status = 'PUBLISHED'
      AND p.feed_enabled = true
  )
);

-- ─── post_comments: 공개 프로그램 피드의 댓글 읽기 ───────────────────
DROP POLICY IF EXISTS "public viewer view comments" ON public.post_comments;
CREATE POLICY "public viewer view comments"
ON public.post_comments
FOR SELECT
TO authenticated
USING (
  verification_id IN (
    SELECT v.id FROM public.verifications v
    JOIN public.missions m ON m.id = v.mission_id
    JOIN public.programs p ON p.id = m.program_id
    WHERE p.is_public = true
      AND p.status = 'PUBLISHED'
      AND p.feed_enabled = true
  )
);
