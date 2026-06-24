-- ============================================================
-- Migration: 132 - 팀 초대 알림 link_path 에 invite id 부착
-- 작성일: 2026-06-24
-- 설명:
--   초대 알림 클릭 시 화면 중앙 "초대 수락 모달"을 자동으로 띄우기 위해,
--   link_path 에 &invite={invite_id} 를 추가. 클라이언트가 이 파라미터를 읽어
--   해당 초대 모달을 연다. (131 의 invite_to_team 에서 link_path 만 보강)
--
--   CREATE OR REPLACE — 치환만, 하위호환.
-- 복구: 131 의 invite_to_team 정의로 재적용.
-- ============================================================

CREATE OR REPLACE FUNCTION public.invite_to_team(
  p_team_id UUID,
  p_invitee_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_program UUID;
  v_leader UUID;
  v_capacity INT;
  v_name TEXT;
  v_count INT;
  v_inviter TEXT;
  v_invite_id UUID;
BEGIN
  SELECT program_id, leader_id, capacity, name
    INTO v_program, v_leader, v_capacity, v_name
  FROM public.teams WHERE id = p_team_id;

  IF v_program IS NULL THEN RAISE EXCEPTION '팀을 찾을 수 없어요'; END IF;
  IF v_leader <> v_uid THEN RAISE EXCEPTION '팀장만 초대할 수 있어요'; END IF;
  IF p_invitee_id = v_uid THEN RAISE EXCEPTION '자기 자신은 초대할 수 없어요'; END IF;

  IF NOT public._is_active_participant(v_program, p_invitee_id) THEN
    RAISE EXCEPTION '이 프로그램의 참여자만 초대할 수 있어요';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.team_members
    WHERE program_id = v_program AND user_id = p_invitee_id
  ) THEN
    RAISE EXCEPTION '이미 다른 팀에 속한 참여자예요';
  END IF;

  SELECT count(*) INTO v_count FROM public.team_members WHERE team_id = p_team_id;
  IF v_count >= v_capacity THEN RAISE EXCEPTION '팀 정원이 가득 찼어요'; END IF;

  INSERT INTO public.team_invites (team_id, inviter_id, invitee_id)
  VALUES (p_team_id, v_uid, p_invitee_id)
  ON CONFLICT (team_id, invitee_id) WHERE status = 'pending' DO NOTHING
  RETURNING id INTO v_invite_id;

  IF v_invite_id IS NULL THEN RAISE EXCEPTION '이미 초대한 참여자예요'; END IF;

  SELECT nickname INTO v_inviter FROM public.users WHERE id = v_uid;
  IF public.is_notification_enabled(p_invitee_id, 'TEAM_INVITE') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
    VALUES (
      p_invitee_id, 'TEAM_INVITE', '👥 팀 초대가 도착했어요',
      COALESCE(v_inviter, '팀장') || '님이 ''' || v_name || ''' 팀에 초대했어요',
      '/programs/' || v_program || '?tab=ranking&team=1&invite=' || v_invite_id,
      v_uid, 'team_invites', v_invite_id
    );
  END IF;

  RETURN v_invite_id;
END;
$$;
