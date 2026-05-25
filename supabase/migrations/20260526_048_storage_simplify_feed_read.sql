-- ============================================================
-- Migration: 048 - 피드 storage SELECT 정책 단순화 (참여자 사진 접근 버그 수정)
-- 작성일: 2026-05-26
-- 설명: 038 의 4-table JOIN (verifications→missions→programs→program_participants) 정책이
--   참여자 컨텍스트에서 어떤 RLS 재귀 / scope 문제로 EXISTS 가 항상 false 반환.
--   결과: 운영자는 사진 보이는데 참여자는 피어 사진을 Object not found 로 받음.
--
-- 해결: 정책을 더 단순하게 — "그 image_path 의 verification 을 SELECT 할 수 있으면 이미지도 sign 가능".
--   RLS 위임 패턴 — verifications RLS (037 + 018 + admin) 가 이미 누가 어떤 인증을 볼 수 있는지 결정.
--   storage 정책은 그걸 그대로 따름 → 권한 모델 일관성 + JOIN 단순화로 RLS 함정 회피.
--
--   기존 021 "owners read own program images" 와 "users read own folder" 는 그대로 유지 —
--   상호 보완 (own folder 는 verifications 행 없어도 본인 폴더 직접 접근, owner 는 program 단위 권한).
--
-- 복구:
--   supabase/rollbacks/048_revert_storage_simplify_feed_read.sql 수동 실행 → 038 시점으로 복원.
-- ============================================================

DROP POLICY IF EXISTS "verification images: feed peers can read" ON storage.objects;

CREATE POLICY "verification images: linked verification visible"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-images'
  AND EXISTS (
    SELECT 1
    FROM public.verifications v
    WHERE v.image_path = storage.objects.name
  )
);
