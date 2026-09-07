-- 255 되돌리기 — 용량(스토리지+DB) 알림 제거.
-- ⚠️ 이미 발송된 CAPACITY_WARNING 알림 행이 있으면 CHECK 제약 복원이 실패한다.
--    그럴 땐 먼저: DELETE FROM public.notifications WHERE type = 'CAPACITY_WARNING';

SELECT cron.unschedule('check-capacity-usage')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-capacity-usage');

DROP FUNCTION IF EXISTS public.check_capacity_usage();
DROP FUNCTION IF EXISTS public.get_storage_usage();
DROP TABLE IF EXISTS public.capacity_alert_state;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'REVIEW_APPROVED', 'REVIEW_REJECTED', 'POST_LIKE', 'POST_COMMENT',
  'PARTICIPANT_JOINED', 'VERIFICATION_SUBMITTED', 'POST_PENDING',
  'POST_APPROVED', 'POST_REJECTED', 'REPORT_RECEIVED',
  'TEAM_INVITE', 'TEAM_JOINED', 'TEAM_REMOVED', 'TEAM_LEADER_CHANGED',
  'INQUIRY_RECEIVED', 'INQUIRY_ANSWERED',
  'OPERATOR_CHEER', 'CONTENT_HIDDEN',
  'NEW_MISSION', 'NEW_QUIZ', 'NEW_CLASS', 'NEW_NOTICE',
  'END_SURVEY_DUE'
));
