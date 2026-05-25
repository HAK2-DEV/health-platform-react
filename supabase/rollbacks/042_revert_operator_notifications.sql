-- ============================================================
-- Rollback: 042 - 운영자 알림 트리거 2종 제거
-- 작성일: 2026-05-25
-- 설명: 042 마이그레이션 되돌림.
--   - 트리거 + 함수 2종 DROP
--   - notifications.type CHECK 원복 (4종)
--   - 이미 INSERT 된 PARTICIPANT_JOINED / VERIFICATION_SUBMITTED 행은
--     CHECK 제약을 다시 가하기 전에 정리 필요 (DELETE)
-- ============================================================

-- 트리거 + 함수 제거
DROP TRIGGER IF EXISTS notify_submit_on_verifications ON public.verifications;
DROP FUNCTION IF EXISTS public.notify_on_verification_submitted();

DROP TRIGGER IF EXISTS notify_join_on_participants ON public.program_participants;
DROP FUNCTION IF EXISTS public.notify_on_participant_join();

-- 새 타입 알림 삭제 (CHECK 원복 전 필수)
DELETE FROM public.notifications
WHERE type IN ('PARTICIPANT_JOINED', 'VERIFICATION_SUBMITTED');

-- CHECK 원복 (4종으로)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'REVIEW_APPROVED', 'REVIEW_REJECTED', 'POST_LIKE', 'POST_COMMENT'
  ));
