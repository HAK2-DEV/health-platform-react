-- ============================================================
-- Migration: 088 - 미리보기(참여 전 내부 둘러보기) 플래그 분리
-- 작성일: 2026-06-18
-- 설명:
--   기존 is_public 하나가 "둘러보기/검색 노출"과 "비참여자 내부 열람"을 모두 담당했음.
--   본인 결정: 두 개념 분리.
--     - is_public        = 둘러보기 목록·검색 노출 (discoverability) — 변경 없음
--     - preview_enabled  = 비참여자가 참여 전 내부를 둘러볼 수 있는지 (이 마이그레이션 신규)
--
--   즉 "공개 검색 허용 + 미리보기 끔" → 둘러보기/검색엔 뜨지만 안은 못 봄(참여해야 열람).
--          "미리보기 켬"            → 비참여자도 내부(커뮤니티/미션/랭킹) 열람 가능.
--
--   087 에서 피드 3종(verifications/post_likes/post_comments) SELECT 를 is_public 로
--   넓혔던 것을 preview_enabled 기준으로 재설정한다. (DROP + CREATE)
--   기본값 false → 기존 공개 프로그램은 미리보기 꺼짐(안전, 하위호환).
--
-- 복구: preview_enabled 컬럼 DROP + 087 의 is_public 기준 정책으로 되돌림.
-- ============================================================

-- 1) 컬럼 추가 (기본 false — 기존 프로그램은 미리보기 꺼짐)
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS preview_enabled BOOLEAN NOT NULL DEFAULT false;

-- 2) 피드 3종 SELECT — preview_enabled 기준으로 재설정 -----------------

-- verifications
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
    WHERE p.preview_enabled = true
      AND p.status = 'PUBLISHED'
      AND p.feed_enabled = true
  )
);

-- post_likes
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
    WHERE p.preview_enabled = true
      AND p.status = 'PUBLISHED'
      AND p.feed_enabled = true
  )
);

-- post_comments
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
    WHERE p.preview_enabled = true
      AND p.status = 'PUBLISHED'
      AND p.feed_enabled = true
  )
);
