-- ============================================================
-- Migration: 097 - 커뮤니티 게시판 글 이미지 버킷 (community-posts)
-- 작성일: 2026-06-20
-- 설명:
--   게시판 글(community_posts) 첨부 이미지용 비공개 버킷.
--   경로 규칙: {userId}/{timestamp}.jpg  (첫 폴더 = 업로더 uid)
--   읽기는 048 패턴 위임 — "그 image_path 의 community_posts 행을 볼 수 있으면 이미지도 sign 가능"
--   + 본인 폴더는 행 없어도 직접 접근(작성 전 미리보기).
--
-- 복구: 버킷·정책 DROP.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('community-posts', 'community-posts', false)
ON CONFLICT (id) DO NOTHING;

-- 읽기: 본인 폴더 OR 볼 수 있는 게시글에 연결된 이미지
DROP POLICY IF EXISTS "community post images: read" ON storage.objects;
CREATE POLICY "community post images: read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'community-posts'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.community_posts cp WHERE cp.image_path = storage.objects.name)
  )
);

-- 업로드: 본인 폴더에만
DROP POLICY IF EXISTS "community post images: insert own" ON storage.objects;
CREATE POLICY "community post images: insert own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'community-posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 수정: 본인 폴더
DROP POLICY IF EXISTS "community post images: update own" ON storage.objects;
CREATE POLICY "community post images: update own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'community-posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 삭제: 본인 폴더
DROP POLICY IF EXISTS "community post images: delete own" ON storage.objects;
CREATE POLICY "community post images: delete own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'community-posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
