-- ============================================================
-- Migration: 050 - profile-avatars storage 버킷 + RLS
-- 작성일: 2026-05-26
-- 설명: 사용자 프로필 사진 저장소 (PUBLIC 버킷).
--   path 규칙: {user_id}/{timestamp}.{ext}
--   PUBLIC → 누구나 객체 SELECT 가능 (avatars 는 공개 정보로 취급)
--   INSERT/UPDATE/DELETE: 본인 폴더만 (auth.uid() 가 path 첫 segment 와 일치)
--
-- 표시:
--   client: supabase.storage.from('profile-avatars').getPublicUrl(avatar_path)
--   별도 signed URL 없이 즉시 URL 발급 → 빠르고 단순
--
-- 복구:
--   supabase/rollbacks/050_revert_profile_avatars_storage.sql 수동 실행.
-- ============================================================

-- 버킷 생성 (PUBLIC=true)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-avatars', 'profile-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;


-- SELECT: 모두 (PUBLIC 버킷이라 public role 포함)
CREATE POLICY "avatar: anyone can read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-avatars');

-- INSERT: 본인 폴더에만
CREATE POLICY "avatar: users upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: 본인 폴더만 (metadata 갱신 등)
CREATE POLICY "avatar: users update own folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: 본인 폴더만 (교체 시 이전 파일 정리)
CREATE POLICY "avatar: users delete own folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ADMIN: 모든 작업
CREATE POLICY "avatar: admins all"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'profile-avatars'
  AND public.is_admin()
);
