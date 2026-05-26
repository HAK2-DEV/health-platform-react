-- ============================================================
-- Migration: 061 - programs.cover_image_path 컬럼 추가 (프로그램 대표 사진)
-- 작성일: 2026-05-26
-- 설명: 운영자가 프로그램 대표 사진을 업로드할 수 있게 storage 경로 컬럼 추가.
--   program-covers 버킷의 객체 name (예: '{owner_id}/{timestamp}.jpg').
--   NULL 이면 표지 없음 → UI 에서 카테고리 이모지 + 그라데이션 fallback.
--
-- 운영 흐름:
--   업로드: client 가 supabase.storage.from('program-covers').upload(...) → cover_image_path 갱신
--   교체:   기존 cover_image_path 의 파일 삭제 후 새 경로 INSERT (orphan 방지)
--   삭제:   cover_image_path = NULL + storage 파일 삭제
--
-- 표시:
--   program-covers 는 PUBLIC 버킷 → supabase.storage.from(...).getPublicUrl(path) 로 즉시 URL
--
-- 미래 진화 (보류):
--   본인이 아이콘 라이브러리를 첨부하면 'preset:KEY' 같은 prefix 형식으로 동일 컬럼 재사용 가능.
--   또는 별도 cover_preset_key 컬럼 추가. 지금은 업로드만 지원.
--
-- 복구:
--   supabase/rollbacks/061_revert_programs_cover_image.sql 수동 실행.
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS cover_image_path TEXT;

COMMENT ON COLUMN public.programs.cover_image_path IS
  'program-covers 버킷의 storage 객체 name. NULL 이면 카테고리 이모지 fallback.';
