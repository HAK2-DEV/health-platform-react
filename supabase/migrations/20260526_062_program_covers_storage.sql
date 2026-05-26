-- ============================================================
-- Migration: 062 - program-covers storage 버킷 + RLS
-- 작성일: 2026-05-26
-- 설명: 프로그램 대표 사진 저장소 (PUBLIC 버킷).
--   path 규칙: {owner_user_id}/{timestamp}.{ext}
--   PUBLIC → 누구나 객체 SELECT 가능 (공개/검색 목록 표시용)
--   INSERT/UPDATE/DELETE: 운영자 본인 폴더만 (auth.uid() 가 path 첫 segment 와 일치)
--
-- 050 (profile-avatars) 와 동일 구조 — 운영자별 폴더 격리만 다름 (owner_id).
--
-- 표시:
--   client: supabase.storage.from('program-covers').getPublicUrl(cover_image_path)
--   별도 signed URL 없이 즉시 URL 발급.
--
-- 복구:
--   supabase/rollbacks/062_revert_program_covers_storage.sql 수동 실행.
-- ============================================================

-- 버킷 생성 (PUBLIC=true)
INSERT INTO storage.buckets (id, name, public)
VALUES ('program-covers', 'program-covers', true)
ON CONFLICT (id) DO UPDATE SET public = true;


-- SELECT: 모두 (PUBLIC 버킷이라 public role 포함 — 둘러보기 등 비로그인도 노출 가능)
CREATE POLICY "cover: anyone can read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'program-covers');

-- INSERT: 본인 폴더에만 (운영자가 자기 프로그램 표지 업로드)
CREATE POLICY "cover: owners upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'program-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: 본인 폴더만
CREATE POLICY "cover: owners update own folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'program-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: 본인 폴더만 (교체 시 이전 파일 정리)
CREATE POLICY "cover: owners delete own folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'program-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ADMIN: 모든 작업
CREATE POLICY "cover: admins all"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'program-covers'
  AND public.is_admin()
);
