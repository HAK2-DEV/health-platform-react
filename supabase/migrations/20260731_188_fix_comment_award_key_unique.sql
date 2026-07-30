-- ============================================================
-- Migration: 188 - 댓글점수 comment_award_key UNIQUE 인덱스 수정 (ON CONFLICT 매칭)
-- 작성일: 2026-07-31
-- 설명:
--   187의 부분(partial) UNIQUE 인덱스(`WHERE comment_award_key IS NOT NULL`)는
--   _award_comment_points()의 `ON CONFLICT (comment_award_key) DO NOTHING` 이 추론하지 못해
--   ("no unique or exclusion constraint matching the ON CONFLICT specification") 예외 발생 →
--   자격 있는 댓글 insert 가 롤백돼 **댓글 작성 자체가 실패**함.
--   해결: 부분 인덱스를 일반 UNIQUE 인덱스로 교체.
--     · NULL 은 UNIQUE 에서 서로 distinct → 기존 미션/퀴즈 행(comment_award_key NULL)은 다중 허용, 무영향.
--     · 비-NULL 키(댓글점수)만 유일성 보장 → ON CONFLICT 정상 추론.
--
-- 하위호환: 인덱스 교체만. 함수/데이터 변경 없음.
-- 복구: 이 인덱스 DROP 후 187의 부분 인덱스 재생성(단, ON CONFLICT 버그 재발).
-- ============================================================

DROP INDEX IF EXISTS public.uq_score_ledgers_comment_award_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_score_ledgers_comment_award_key
  ON public.score_ledgers(comment_award_key);
