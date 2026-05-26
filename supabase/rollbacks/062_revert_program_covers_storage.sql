-- Rollback 062
DROP POLICY IF EXISTS "cover: anyone can read" ON storage.objects;
DROP POLICY IF EXISTS "cover: owners upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "cover: owners update own folder" ON storage.objects;
DROP POLICY IF EXISTS "cover: owners delete own folder" ON storage.objects;
DROP POLICY IF EXISTS "cover: admins all" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'program-covers';
