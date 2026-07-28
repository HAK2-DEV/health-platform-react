-- ============================================================
-- Migration: 182 - Realtime publication 에 커뮤니티 소셜 테이블 추가
-- 작성일: 2026-07-29
-- 설명:
--   커뮤니티 글의 「댓글·좋아요」도 실시간 반영하기 위해 세 테이블을
--   supabase_realtime publication 에 등록한다. (181=글 본문에 이어)
--     - community_post_comments       : 새 댓글/답글 즉시 표시
--     - community_post_likes          : 좋아요 수 즉시 갱신
--     - community_post_comment_likes  : 댓글 좋아요 수 즉시 갱신
--   Realtime 은 RLS 존중 → 같은 프로그램 멤버/운영자에게만 이벤트 배달.
--   클라이언트(useRealtimeSync)가 수신 시 관련 캐시(community-post-social /
--     community-comment-likes / community-posts)를 무효화한다.
--   패턴은 164·181 과 동일(멱등 가드).
--
--   멱등: 이미 있으면 건너뜀. publication 없으면 아무 것도 안 함.
-- 영향: 스키마/데이터 변경 없음. WAL 스트리밍 대상만 확대.
--
-- 복구:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.community_post_comments;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.community_post_likes;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.community_post_comment_likes;
-- ============================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['community_post_comments', 'community_post_likes', 'community_post_comment_likes'];
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
