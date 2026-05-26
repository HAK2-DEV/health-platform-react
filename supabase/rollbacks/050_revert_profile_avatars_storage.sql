-- ============================================================
-- Rollback: 050 - profile-avatars 버킷 정책 + 버킷 자체 제거
-- 주의: 버킷 안 객체가 있으면 DROP 실패 — 먼저 비워야 함.
-- ============================================================

DROP POLICY IF EXISTS "avatar: anyone can read" ON storage.objects;
DROP POLICY IF EXISTS "avatar: users upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "avatar: users update own folder" ON storage.objects;
DROP POLICY IF EXISTS "avatar: users delete own folder" ON storage.objects;
DROP POLICY IF EXISTS "avatar: admins all" ON storage.objects;

-- 버킷 안 객체 모두 삭제 후 버킷 삭제 (객체 있으면 실패)
DELETE FROM storage.objects WHERE bucket_id = 'profile-avatars';
DELETE FROM storage.buckets WHERE id = 'profile-avatars';
