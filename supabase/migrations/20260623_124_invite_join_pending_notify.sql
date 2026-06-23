-- ============================================================
-- Migration: 124 - 초대링크 가입(승인 대기) 알림 + 통계 참여유저관리로 딥링크
-- 작성일: 2026-06-23
-- 설명:
--   문제: notify_on_participant_join 이 join_type='APPROVAL' 일 때만 알림을 보내,
--         초대링크+운영자 승인(join_type='INVITE_CODE', invite_requires_approval) 가입은
--         운영자에게 알림이 안 갔다.
--   해결:
--     1) 조건을 'PENDING 으로 새로 진입' 로 변경 — APPROVAL / INVITE_CODE+승인 모두 커버.
--     2) link_path 를 통계-참여유저관리(/stats/users?pending=<participant_id>) 로 → 그 신청자로 스크롤.
--     3) 재참여(UPDATE: 다른 상태 → PENDING)도 알림 — AFTER UPDATE 트리거 추가.
--
--   하위호환: 기존 APPROVAL 가입 알림 그대로 + 초대 승인까지 확장. link_path 만 바뀜(구버전 프론트도 graceful).
--
-- 복구: 072 의 notify_on_participant_join() 본문 + 042 의 INSERT 트리거만 남기고 UPDATE 트리거 DROP.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_on_participant_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_program_name TEXT;
  v_actor_nickname TEXT;
BEGIN
  -- PENDING(승인 대기)으로 '새로' 진입한 경우만. (자유참여 ACTIVE 는 알림 X)
  IF NEW.status != 'PENDING' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'PENDING' THEN RETURN NEW; END IF;

  SELECT p.owner_id, p.name INTO v_owner_id, v_program_name
  FROM public.programs p WHERE p.id = NEW.program_id;

  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN RETURN NEW; END IF;
  IF NOT public.is_notification_enabled(v_owner_id, 'PARTICIPANT_JOINED') THEN RETURN NEW; END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_owner_id,
    'PARTICIPANT_JOINED',
    '👋 가입 승인 요청',
    COALESCE(v_actor_nickname, '(?)') || '님이 ' || v_program_name || ' 가입을 요청했어요',
    '/programs/' || NEW.program_id::text || '/stats/users?pending=' || NEW.id::text,
    NEW.user_id,
    'program_participants',
    NEW.id
  );

  RETURN NEW;
END;
$$;

-- 재참여(UPDATE 로 PENDING 진입) 도 알림 — 기존 AFTER INSERT 트리거(notify_join_on_participants)는 유지
DROP TRIGGER IF EXISTS notify_join_on_participants_update ON public.program_participants;
CREATE TRIGGER notify_join_on_participants_update
AFTER UPDATE ON public.program_participants
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_participant_join();
