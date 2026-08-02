-- ============================================================
-- Migration: 196 - Realtime publication 에 인증 피드 소셜 테이블 추가
-- 작성일: 2026-08-02
-- 설명:
--   인증글(피드) 의 「댓글·좋아요」도 실시간 반영하기 위해 세 테이블을
--   supabase_realtime publication 에 등록한다. (182=커뮤니티 글 소셜에 이어)
--     - post_comments         : 인증글 새 댓글/답글(=응원) 즉시 표시
--     - post_likes            : 인증글 좋아요 수 즉시 갱신
--     - post_comment_likes    : 인증글 댓글 좋아요 수 즉시 갱신 (베스트 응원 순위)
--   Realtime 은 RLS 존중 → 같은 프로그램 멤버/운영자에게만 이벤트 배달.
--   클라이언트(useRealtimeSync)가 수신 시 관련 캐시(post-comments / feed posts /
--     recent-cheers / best-cheers / post-comment-likes)를 무효화한다.
--   패턴은 182 와 동일(멱등 가드).
--
--   멱등: 이미 있으면 건너뜀. publication 없으면 아무 것도 안 함.
-- 영향: 스키마/데이터 변경 없음. WAL 스트리밍 대상만 확대.
--
-- 복구:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.post_comments;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.post_likes;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.post_comment_likes;
-- ============================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['post_comments', 'post_likes', 'post_comment_likes'];
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
