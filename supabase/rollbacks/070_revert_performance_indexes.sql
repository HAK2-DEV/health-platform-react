-- ============================================================
-- 070 복구: 성능 인덱스 제거
-- ============================================================
-- 인덱스 제거 — 데이터 손실 없음. INSERT 약간 빨라지고 query 약간 느려짐.

BEGIN;

DROP INDEX IF EXISTS public.idx_verifications_user_submitted;
DROP INDEX IF EXISTS public.idx_verifications_feed;
DROP INDEX IF EXISTS public.idx_post_comments_verification_created;

COMMIT;
