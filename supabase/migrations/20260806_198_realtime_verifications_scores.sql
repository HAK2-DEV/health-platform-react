-- ============================================================
-- Migration: 198 - Realtime publication 에 인증·점수·퀴즈제출·알림 추가
-- 작성일: 2026-08-06
-- 설명:
--   운영자↔참여자 상호작용을 실시간으로 반영하기 위해 네 테이블을
--   supabase_realtime publication 에 등록한다. (196/197 에 이어)
--     - verifications     : 인증 제출(→운영자 심사목록) · 승인/거절(→참여자 상태) 즉시 반영
--     - score_ledgers     : 점수 지급/변동 → 랭킹·통계·홈지표 즉시 갱신
--     - quiz_submissions  : 퀴즈 제출 → 결과·통계 즉시 갱신
--     - notifications     : 알림 생성 → 알림 목록·뱃지 즉시 갱신
--   Realtime 은 RLS 존중 → 각자 SELECT 할 수 있는 행만 배달됨.
--     (운영자=자기 프로그램 인증/점수, 참여자=본인 것. 알림=수신자 본인.)
--   클라이언트(useRealtimeSync)가 수신 시 관련 캐시를 무효화한다.
--   패턴은 196/197 과 동일(멱등 가드).
--
--   멱등: 이미 있으면 건너뜀. publication 없으면 아무 것도 안 함.
-- 영향: 스키마/데이터 변경 없음. WAL 스트리밍 대상만 확대.
--
-- 복구:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.verifications;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.score_ledgers;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.quiz_submissions;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
-- ============================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['verifications', 'score_ledgers', 'quiz_submissions', 'notifications'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'supabase_realtime publication 이 없어 건너뜁니다.';
    RETURN;
  END IF;

  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
