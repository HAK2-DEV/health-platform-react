-- ============================================================
-- Migration: 199 - Realtime publication 에 팀·신고·클래스·문의·퀴즈문항·기분 추가
-- 작성일: 2026-08-06
-- 설명:
--   운영자↔참여자 / 참여자↔참여자 상호작용을 폭넓게 실시간 반영하기 위해
--   열 개 테이블을 supabase_realtime publication 에 등록한다. (198 에 이어)
--     - teams, team_members, team_invites : 팀 생성·참여·초대·위임 → 팀 카드·팀원·팀 랭킹
--     - reports                           : 신고 → 운영자 신고 처리함·미해결 뱃지
--     - session_registrations             : 클래스 신청/취소 → 신청자 명단·정원
--     - session_attendance                : 출석 체크 → 참여자 출석 상태
--     - inquiries, inquiry_comments       : 1:1 문의·관리자 답변
--     - quiz_questions                    : 퀴즈 문항 편집 → 푸는 화면
--     - mood_logs                         : 금연 기분체크 → 추이·개요 통계
--   Realtime 은 RLS 존중 → 각자 SELECT 할 수 있는 행만 배달됨.
--   클라이언트(useRealtimeSync)가 수신 시 관련 캐시를 무효화한다.
--   패턴은 196/197/198 과 동일(멱등 가드).
--
--   멱등: 이미 있으면 건너뜀. publication 없으면 아무 것도 안 함.
-- 영향: 스키마/데이터 변경 없음. WAL 스트리밍 대상만 확대.
--
-- 복구:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.teams;   -- (각 테이블 반복)
-- ============================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'teams', 'team_members', 'team_invites',
    'reports',
    'session_registrations', 'session_attendance',
    'inquiries', 'inquiry_comments',
    'quiz_questions',
    'mood_logs'
  ];
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
