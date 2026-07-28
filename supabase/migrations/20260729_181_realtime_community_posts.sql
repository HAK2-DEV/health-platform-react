-- ============================================================
-- Migration: 181 - Realtime publication 에 community_posts 추가
-- 작성일: 2026-07-29
-- 설명:
--   커뮤니티(공지·자유게시판) 글을 「실시간」으로 반영하기 위해 community_posts 를
--   supabase_realtime publication 에 등록한다.
--     - 다른 참여자가 새 글을 쓰면, 화면을 켜둔 사용자의 목록에 즉시 나타남.
--   Realtime 은 RLS 를 존중 → 「내가 SELECT 할 수 있는 행」만 배달됨(같은 프로그램 멤버·운영자).
--   클라이언트(useRealtimeSync)가 이벤트 수신 시 ['community-posts'] 캐시를 무효화한다.
--   패턴은 164(programs/participants)와 동일.
--
--   멱등: 이미 publication 에 있으면 건너뜀. publication 이 없으면 아무 것도 안 함.
-- 영향: 스키마/데이터 변경 없음. WAL 스트리밍 대상만 확대. 기존 코드 동작 불변.
--
-- 복구:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.community_posts;
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'supabase_realtime publication 이 없어 건너뜁니다.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'community_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
  END IF;
END $$;
