-- ============================================================
-- Migration: 106 - 미션 인증 화면 히어로 전용 이미지 (missions.hero_image_path)
-- 작성일: 2026-06-22
-- 설명:
--   인증 화면 상단 히어로는 가로(16:9) 배치라, 보통 세로 사진은 원하는 부분이
--   안 보인다. 운영자가 사진을 16:9 로 크롭(위치·줌 조절)해 히어로 전용 이미지를
--   따로 저장한다. icon_path(목록·작은 아이콘)와는 **별개** 필드.
--     - NULL  → 히어로는 기존 icon_path 로 폴백
--     - 값(전체 public URL) → 히어로에 이 이미지 표시
--   하위호환: nullable 컬럼만 추가. 컬럼 모르는 기존 코드/조회는 그대로 동작.
--   단, hero_image_path 를 저장(UPDATE)하는 새 코드는 이 마이그레이션 프로드 선적용 필요.
--
-- 복구:
--   ALTER TABLE public.missions DROP COLUMN IF EXISTS hero_image_path;
-- ============================================================

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS hero_image_path TEXT;
