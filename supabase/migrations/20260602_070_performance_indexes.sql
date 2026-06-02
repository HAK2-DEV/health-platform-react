-- ============================================================
-- 070: 성능 인덱스 추가 (선제적) — MAU 100+ 베타 대비
-- ============================================================
-- 작성일: 2026-06-02
-- 설명: 본인 결정 (Day 65) — Supabase NANO + Free 플랜에서 사용자 증가 시
--       자주 쓰는 query 3가지가 ORDER BY 추가 정렬 비용 발생 → 인덱스 보완.
--
-- 현재(DAU 12명, DB ~30MB)에서는 효과 미미. 본격 베타 시점에 큰 차이.
--
-- 추가 인덱스:
--   1) verifications(user_id, submitted_at DESC)
--      → MyActivityPage / MyVerificationsByBundle: WHERE user_id ORDER BY submitted_at DESC
--   2) verifications(mission_id, submitted_at DESC) WHERE status='APPROVED' AND feed_visible=true
--      → fetchFeedPosts: missions!inner JOIN 후 status+feed_visible 필터 + ORDER BY
--      → partial index — RAM 부담 최소화 (NANO 인스턴스 51% baseline 고려)
--   3) post_comments(verification_id, created_at)
--      → 댓글 정렬: WHERE verification_id IN (...) ORDER BY created_at ASC
--
-- 트레이드오프:
--   - INSERT 시 인덱스 업데이트 비용 약간 증가 (인증 1건 → 인덱스 1-2개 갱신, 무시 가능)
--   - RAM 사용 약간 증가 (partial 사용으로 최소화)
--
-- 복구: rollbacks/070_revert_performance_indexes.sql

BEGIN;

-- 1) MyActivity / MyVerifications 가속
CREATE INDEX IF NOT EXISTS idx_verifications_user_submitted
  ON public.verifications(user_id, submitted_at DESC);

-- 2) Feed query 가속 (partial — APPROVED + feed_visible 만)
CREATE INDEX IF NOT EXISTS idx_verifications_feed
  ON public.verifications(mission_id, submitted_at DESC)
  WHERE status = 'APPROVED' AND feed_visible = true;

-- 3) 댓글 정렬 가속
CREATE INDEX IF NOT EXISTS idx_post_comments_verification_created
  ON public.post_comments(verification_id, created_at);

COMMIT;

-- 주의: 기존 인덱스와 중복되지 않음
--   - idx_verifications_user (user_id 단일) 는 다른 쿼리(예: 단순 user 카운트)에서 여전히 유효
--   - idx_verifications_mission (mission_id 단일) 는 status 필터 없는 query에서 유효
--   - idx_post_comments_verification (verification_id 단일) 는 단순 verification 매칭에 유효
--   PostgreSQL 옵티마이저가 query 별로 가장 효율적인 인덱스 선택
