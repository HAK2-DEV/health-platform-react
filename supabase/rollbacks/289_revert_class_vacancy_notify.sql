-- ============================================================
-- Rollback: 289 - 클래스 빈자리 운영자 알림 되돌리기
-- 작성일: 2026-10-13
--   트리거·함수를 지우고 notifications 의 type CHECK 를 255 목록으로 되돌린다.
--   이미 만들어진 CLASS_VACANCY 알림 행은 CHECK 복원 «전에» 지워야 한다
--   (남겨 두면 ADD CONSTRAINT 가 기존 행 검사에서 실패한다).
-- ============================================================

DROP TRIGGER IF EXISTS session_reg_vacancy_trg ON public.session_registrations;
DROP FUNCTION IF EXISTS public.notify_on_session_vacancy();

DELETE FROM public.notifications WHERE type = 'CLASS_VACANCY';

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'REVIEW_APPROVED', 'REVIEW_REJECTED', 'POST_LIKE', 'POST_COMMENT',
  'PARTICIPANT_JOINED', 'VERIFICATION_SUBMITTED', 'POST_PENDING',
  'POST_APPROVED', 'POST_REJECTED', 'REPORT_RECEIVED',
  'TEAM_INVITE', 'TEAM_JOINED', 'TEAM_REMOVED', 'TEAM_LEADER_CHANGED',
  'INQUIRY_RECEIVED', 'INQUIRY_ANSWERED',
  'OPERATOR_CHEER', 'CONTENT_HIDDEN',
  'NEW_MISSION', 'NEW_QUIZ', 'NEW_CLASS', 'NEW_NOTICE',
  'END_SURVEY_DUE',
  'CAPACITY_WARNING'
));
