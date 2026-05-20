-- ============================================================
-- Migration: 021 - Storage 버킷 'verification-images' + RLS
-- 작성일: 2026-05-20
-- 설명: 미션 인증 사진 저장소
--
-- 파일 경로 규칙: {user_id}/{filename}
--   예: 5c33cc7e-.../2026-05-20T10-30-00.jpg
--   storage.foldername(name)[1] 이 user_id 와 일치해야 본인 폴더로 인정.
--
-- public=false: 비공개 버킷.
--   클라이언트는 createSignedUrl(path, 만료초) 로 임시 URL 받아 접근.
--
-- RLS 정책:
--   INSERT: 본인 폴더에만 업로드 가능
--   SELECT: 본인 폴더 + 운영자가 자기 프로그램의 인증 사진 (심사용)
--   DELETE: 본인 파일만 (취소 시)
--   ADMIN:  모든 작업
-- ============================================================

-- 버킷 생성 (이미 있으면 무시)
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-images', 'verification-images', false)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- RLS 정책 (storage.objects 에 정책 추가)
-- ============================================================

-- INSERT: 본인 폴더에만 (path 첫 segment = auth.uid())
CREATE POLICY "verification images: users upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT: 본인 폴더
CREATE POLICY "verification images: users read own folder"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT: 운영자가 자기 프로그램의 인증 사진 (심사용)
CREATE POLICY "verification images: owners read own program images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-images'
  AND EXISTS (
    SELECT 1 FROM public.verifications v
    JOIN public.missions m ON m.id = v.mission_id
    JOIN public.programs p ON p.id = m.program_id
    WHERE v.image_path = name
      AND p.owner_id = auth.uid()
  )
);

-- DELETE: 본인 파일만
CREATE POLICY "verification images: users delete own folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'verification-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ADMIN: 모든 작업
CREATE POLICY "verification images: admins all"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'verification-images'
  AND public.is_admin()
);
