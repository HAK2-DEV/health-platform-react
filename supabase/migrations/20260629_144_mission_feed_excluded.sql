-- ============================================================
-- Migration: 144 - missions.feed_excluded (피드 제외 미션 = 운영자 전용)
-- 작성일: 2026-06-29
-- 설명:
--   특정 미션의 인증을 「응원/커뮤니티 피드」에서 제외(운영자만 「참가자 추세」에서 열람).
--   금연 '흡연 욕구가 올라온 순간'(craving_moment) 처럼 사적인 기록용.
--   nullable 아님 + DEFAULT false → 기존 미션은 그대로 피드 노출(하위호환).
--
--   백필: 기존 '흡연 욕구가 올라온 순간' 미션을 운영자 전용으로 전환.
--
-- 영향: missions 컬럼 1개 추가. fetchFeedPosts 가 이 컬럼으로 필터(코드는 적용 후 배포).
--
-- 복구:
--   ALTER TABLE public.missions DROP COLUMN IF EXISTS feed_excluded;
-- ============================================================

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS feed_excluded BOOLEAN NOT NULL DEFAULT false;

-- 기존 '흡연 욕구가 올라온 순간' 미션 → 운영자 전용(피드 제외)
UPDATE public.missions
   SET feed_excluded = true
 WHERE title = '흡연 욕구가 올라온 순간'
   AND feed_excluded = false;
