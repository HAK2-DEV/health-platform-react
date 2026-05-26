-- ============================================================
-- Migration: 049 - users.avatar_path 컬럼 추가 (프로필 사진)
-- 작성일: 2026-05-26
-- 설명: 사용자 프로필 사진의 storage 경로 저장.
--   profile-avatars 버킷의 객체 name (예: '{user_id}/{timestamp}.jpg').
--   NULL 이면 아바타 없음 → UI 에서 이모지/이니셜 fallback.
--
-- 운영 흐름:
--   업로드: client 가 supabase.storage.from('profile-avatars').upload(...) → users.avatar_path 갱신
--   교체:   기존 avatar_path 의 파일 삭제 후 새 경로 INSERT (orphan 방지)
--   삭제:   users.avatar_path = NULL + storage 파일 삭제
--
-- 표시:
--   profile-avatars 는 PUBLIC 버킷 → supabase.storage.from(...).getPublicUrl(path) 로 즉시 URL
--   캐시 함정 회피: URL 에 ?t={updated_at} 같은 쿼리 부착 추천 (브라우저 캐싱)
--
-- 복구:
--   supabase/rollbacks/049_revert_users_avatar_path.sql 수동 실행.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_path TEXT;

COMMENT ON COLUMN public.users.avatar_path IS
  'profile-avatars 버킷의 storage 객체 name. NULL 이면 아바타 없음.';
