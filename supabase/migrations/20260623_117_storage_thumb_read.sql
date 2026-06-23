-- ============================================================
-- Migration: 117 - 썸네일(_thumb) 이미지 읽기 허용 (storage SELECT 정책 확장)
-- 작성일: 2026-06-23
-- 설명:
--   목록·그리드용 썸네일을 원본 옆 경로 `<base>_thumb.<ext>` 에 저장한다.
--   그런데 기존 storage 읽기 정책은 `image_path = name` 정확 매칭이라, 이름이 다른
--   썸네일은 업로더 본인만 읽고 피어/운영자는 못 읽어(→ 404 → 원본 폴백, 썸네일 무용).
--   해결: 정책에서 name 의 `_thumb` 를 벗긴 '원본 경로'로 매칭 → 원본을 볼 수 있는
--         사람은 그 썸네일도 읽을 수 있게. (원본 이름은 regexp no-op 으로 기존과 동일)
--
--   대상: verification-images(048 정책), community-posts(097 정책).
--   하위호환: 원본 경로 매칭은 그대로 + 썸네일만 추가 허용(권한 넓힘). 업로드/삭제 정책 불변.
--
-- 복구:
--   048 / 097 의 원래 SELECT 정책 본문으로 되돌리면 됨(아래 regexp 를 = name 으로).
-- ============================================================

-- 1) verification-images — 연결된 인증을 볼 수 있으면 그 썸네일도 읽기
DROP POLICY IF EXISTS "verification images: linked verification visible" ON storage.objects;
CREATE POLICY "verification images: linked verification visible"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-images'
  AND EXISTS (
    SELECT 1 FROM public.verifications v
    WHERE v.image_path = regexp_replace(storage.objects.name, '_thumb(\.[^.]*)$', '\1')
  )
);

-- 2) community-posts — 본인 폴더 OR 볼 수 있는 게시글의 (썸네일 포함) 이미지
DROP POLICY IF EXISTS "community post images: read" ON storage.objects;
CREATE POLICY "community post images: read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'community-posts'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.community_posts cp
      WHERE cp.image_path = regexp_replace(storage.objects.name, '_thumb(\.[^.]*)$', '\1')
    )
  )
);
