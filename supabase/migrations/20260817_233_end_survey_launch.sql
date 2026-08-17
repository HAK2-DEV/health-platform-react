-- ============================================================
-- Migration: 233 - 종료 설문 운영자 확정 발송 + 종료 임박 알림
-- 작성일: 2026-08-17
-- 설명:
--   종료 설문을 참여자에게 자동으로 내보내지 않고, 운영자가 문항을 검토한 뒤
--   "종료 설문 시작"으로 확정해야 나가도록. + 종료 임박 시 운영자에게 알림(인앱+푸시).
--   - programs.end_survey_started_at : null=미시작. 운영자가 시작하면 시각 기록(참여자 트리거 게이트).
--   - programs.end_survey_notified_at : "검토하세요" 알림 1회 발송 시각(중복 방지).
--   - notifications 타입 'END_SURVEY_DUE' 추가.
--   - notify_end_survey_due(): 종료 D-3~D-0·미시작·미알림 프로그램의 운영자에게 알림 INSERT
--     (INSERT 트리거로 Web Push 발송 — 마이그 178). pg_cron 매일 호출.
--
-- 하위호환: 컬럼 추가(nullable) + 타입 확장 + 새 함수/크론. 기존 흐름 무변경(미시작=기존과 동일).
-- 복구:
--   select cron.unschedule('notify-end-survey-due');
--   drop function if exists public.notify_end_survey_due();
--   alter table public.programs drop column if exists end_survey_started_at, drop column if exists end_survey_notified_at;
-- ============================================================

alter table public.programs add column if not exists end_survey_started_at  timestamptz;  -- null=미시작(게이트)
alter table public.programs add column if not exists end_survey_notified_at timestamptz;  -- 운영자 알림 1회

-- 알림 타입 확장 (기존 목록 + END_SURVEY_DUE)
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'REVIEW_APPROVED', 'REVIEW_REJECTED', 'POST_LIKE', 'POST_COMMENT',
  'PARTICIPANT_JOINED', 'VERIFICATION_SUBMITTED', 'POST_PENDING',
  'POST_APPROVED', 'POST_REJECTED', 'REPORT_RECEIVED',
  'TEAM_INVITE', 'TEAM_JOINED', 'TEAM_REMOVED', 'TEAM_LEADER_CHANGED',
  'INQUIRY_RECEIVED', 'INQUIRY_ANSWERED',
  'OPERATOR_CHEER', 'CONTENT_HIDDEN',
  'NEW_MISSION', 'NEW_QUIZ', 'NEW_CLASS', 'NEW_NOTICE',
  'END_SURVEY_DUE'
));

-- 종료 임박(D-3~D-0)·미시작·미알림 프로그램의 운영자에게 검토 알림.
--   같은 문장에서 대상 프로그램을 notified 로 마킹(원자적) 후 알림 INSERT → 중복 없음.
create or replace function public.notify_end_survey_due()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with due as (
    update public.programs p
      set end_survey_notified_at = now()
    where p.status = 'PUBLISHED'
      and coalesce(p.survey_enabled, false) = true
      and p.end_survey_started_at is null
      and p.end_survey_notified_at is null
      and p.end_date is not null
      and (p.end_date - (now() at time zone 'Asia/Seoul')::date) between 0 and 3   -- 종료 3일 전 ~ 당일(KST)
    returning p.id, p.owner_id, p.name
  )
  insert into public.notifications (user_id, type, title, body, link_path)
  select d.owner_id, 'END_SURVEY_DUE', '종료 설문 준비',
         d.name || ' 마무리가 다가와요. 종료 설문 문항을 검토하고 시작하세요.',
         '/programs/' || d.id
  from due d;
end;
$$;

-- 매일 KST 00:10 (UTC 15:10)
do $$
begin
  perform cron.unschedule('notify-end-survey-due') where exists (
    select 1 from cron.job where jobname = 'notify-end-survey-due'
  );
exception when others then null;
end $$;

select cron.schedule('notify-end-survey-due', '10 15 * * *', $$select public.notify_end_survey_due();$$);
