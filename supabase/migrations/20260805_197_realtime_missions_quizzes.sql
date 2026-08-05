-- ============================================================
-- Migration: 197 - Realtime publication 에 미션·퀴즈 테이블 추가
-- 작성일: 2026-08-05
-- 설명:
--   운영자가 새 미션/퀴즈를 발행하면 참여자 화면에 즉시 나타나도록
--   두 테이블을 supabase_realtime publication 에 등록한다.
--   (지금은 알림(푸시)만 즉시 가고, 목록은 새로고침해야 보였음)
--     - missions : 새 미션 발행/수정/삭제 시 미션 목록 즉시 갱신
--     - quizzes  : 새 퀴즈 발행/수정/삭제 시 퀴즈 목록 즉시 갱신
--   Realtime 은 RLS 존중 → 해당 프로그램을 SELECT 할 수 있는 멤버/운영자에게만 배달.
--   클라이언트(useRealtimeSync)가 수신 시 ['missions'] / ['quizzes'] 캐시를 무효화한다.
--   패턴은 196 과 동일(멱등 가드).
--
--   멱등: 이미 있으면 건너뜀. publication 없으면 아무 것도 안 함.
-- 영향: 스키마/데이터 변경 없음. WAL 스트리밍 대상만 확대.
--
-- 복구:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.missions;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.quizzes;
-- ============================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['missions', 'quizzes'];
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
