-- ============================================================
-- Migration: 171 - Realtime publication 에 sessions 추가 (선착순 신청 즉시 반영)
-- 작성일: 2026-07-26
-- 설명:
--   클래스 세션 「신청 인원/정원 마감」을 실시간으로 반영하기 위해 public.sessions 를
--   supabase_realtime publication 에 등록한다.
--     - 배경: 정원 8, 7명 신청 상태에서 A가 마지막 자리를 신청하면 sessions.registered_count
--       가 트리거(159)로 8로 갱신된다. 이 UPDATE 를 구독하면, 다른 참가자 B의 화면이
--       아무 조작 없이 즉시 「정원 마감」으로 바뀐다.
--     - session_registrations 가 아니라 sessions 를 구독하는 이유: registered_count 가
--       sessions 행에 반정규화돼 있고(159), sessions 는 활성 참가자 SELECT 가능(158 RLS)이라
--       모든 참가자에게 배달된다. session_registrations 는 본인 행만 보여 B가 A의 신청을 못 받음.
--   Realtime 은 RLS 존중 → 참가자는 자기 프로그램 세션 행만 배달받는다.
--   클라이언트(useRealtimeSync)가 수신 시 ['session']·['sessions'] 캐시를 무효화한다.
--
--   멱등: 이미 publication 에 있으면 건너뜀. publication 이 없으면(로컬 등) 무해하게 종료.
--
-- 영향: 스키마/데이터 변경 없음. WAL 스트리밍 대상만 확대. 기존 코드 동작 불변.
--
-- 복구:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.sessions;
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
      AND tablename = 'sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
  END IF;
END $$;
