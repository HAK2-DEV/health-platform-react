-- ============================================================
-- Migration: 164 - Realtime publication 에 programs / program_participants 추가
-- 작성일: 2026-07-14
-- 설명:
--   참여자 수·둘러보기 목록을 「실시간」으로 반영하기 위해 두 테이블을
--   supabase_realtime publication 에 등록한다.
--     - program_participants: 참여/탈퇴/승인 시 참여자 수 즉시 갱신
--     - programs: 신규 게시(PUBLISHED)·수정 시 둘러보기 목록 즉시 갱신
--   Realtime 은 RLS 를 존중 → 「내가 SELECT 할 수 있는 행」만 클라이언트로 배달된다.
--     운영자: 자기 프로그램의 참여자 행 / 참가자: 본인 참여 행 /
--     공개(PUBLISHED+is_public) 프로그램: 모든 로그인 사용자.
--   클라이언트(useRealtimeSync)는 이벤트 수신 시 관련 react-query 캐시를 무효화한다.
--
--   멱등: 이미 publication 에 있으면 건너뜀. publication 이 없으면(예외) 아무 것도 안 함.
--
-- 영향: 스키마/데이터 변경 없음. WAL 스트리밍 대상만 확대. 기존 코드 동작 불변.
--
-- 복구:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.program_participants;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.programs;
-- ============================================================

DO $$
BEGIN
  -- publication 자체가 없으면(로컬 등) 안전하게 종료
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'supabase_realtime publication 이 없어 건너뜁니다.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'program_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.program_participants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'programs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.programs;
  END IF;
END $$;