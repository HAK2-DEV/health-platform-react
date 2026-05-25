-- ============================================================
-- Migration: 038 - Storage RLS — 피드 참여자가 다른 참여자의 인증 사진 SELECT 허용
-- 작성일: 2026-05-25
-- 설명: 037 verifications RLS 와 짝. verifications row 는 보이지만
--   storage 의 실제 파일은 본인 폴더만 읽을 수 있어서 createSignedUrl null 반환.
--   → 피드에서 다른 참여자 사진이 "사진 불러오는 중..." 으로만 보임.
--
-- 새 정책:
--   feed_enabled=true 인 프로그램의 ACTIVE 참여자 → 그 프로그램의 APPROVED 인증 사진 SELECT
--
-- 본인 사진 (021 의 "users read own folder") + 운영자 (021) + 피드 참여자 (이 정책)
--
-- 복구:
--   supabase/rollbacks/038_revert_storage_feed_peer_read.sql 수동 실행.
-- ============================================================

CREATE POLICY "verification images: feed peers can read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-images'
  AND EXISTS (
    SELECT 1 FROM public.verifications v
    JOIN public.missions m ON m.id = v.mission_id
    JOIN public.programs p ON p.id = m.program_id
    JOIN public.program_participants pp ON pp.program_id = p.id
    WHERE v.image_path = name
      AND v.status = 'APPROVED'
      AND p.feed_enabled = true
      AND pp.user_id = auth.uid()
      AND pp.status = 'ACTIVE'
  )
);
