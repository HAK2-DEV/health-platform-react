-- ============================================================
-- Rollback: 282 - 운영자 한 줄 소개 + 기록 보강 되돌리기
-- 주의: 화면 코드가 operator_bio / comment_90d 를 쓰는 상태면 코드부터 되돌린 뒤 실행한다.
--       281 의 함수(컬럼 4개)로 돌아가려면 281 파일을 다시 실행한다.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_operator_record(UUID);
DROP INDEX IF EXISTS public.idx_post_comments_user_created;
DROP INDEX IF EXISTS public.idx_community_post_comments_user_created;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_operator_bio_len;
ALTER TABLE public.users DROP COLUMN IF EXISTS operator_bio;
