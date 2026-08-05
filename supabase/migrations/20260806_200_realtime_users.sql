-- ============================================================
-- Migration: 200 - Realtime publication 에 users 추가 (프로필·아바타)
-- 작성일: 2026-08-06
-- 설명:
--   닉네임·아바타 변경이 랭킹·피드·댓글·심사목록 등 사용자 표시 화면에
--   실시간 반영되도록 users 를 supabase_realtime publication 에 등록한다.
--   (196~199 에 이어 마지막)
--   Realtime 은 RLS 존중 → SELECT 가능한 users 행만 배달됨.
--   프로필 변경은 드물어서(닉 7일 제한 등) 이벤트 트래픽은 낮음.
--   클라이언트(useRealtimeSync)가 수신 시 표시 캐시(랭킹·피드·댓글·심사·통계)를 무효화한다.
--   패턴은 이전 realtime 마이그와 동일(멱등 가드).
--
--   멱등: 이미 있으면 건너뜀. publication 없으면 아무 것도 안 함.
-- 영향: 스키마/데이터 변경 없음. WAL 스트리밍 대상만 확대.
--
-- 복구:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.users;
-- ============================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['users'];
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
