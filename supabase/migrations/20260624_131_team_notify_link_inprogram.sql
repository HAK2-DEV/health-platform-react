-- ============================================================
-- Migration: 131 - 팀 알림 딥링크를 "프로그램 내 랭킹 탭"으로 변경
-- 작성일: 2026-06-24
-- 설명:
--   팀 관련 알림 클릭 시 하단 네비 전역 랭킹(/rankings)이 아니라 해당 프로그램의
--   랭킹 탭(/programs/:id?tab=ranking&team=1)으로 이동하도록 link_path 변경.
--   ProgramDetailPage 가 ?team=1 을 읽어 팀 탭으로 시작 → 거기서 받은 초대 수락.
--
--   영향 함수(알림 INSERT 부분의 link_path 만 변경, 로직 동일):
--     invite_to_team(129), respond_team_invite(129),
--     remove_team_member(130), leave_team(130), transfer_team_leader(130)
--   기존에 생성된 알림 행의 link_path 는 그대로(과거 경로) — 신규부터 적용.
--
--   CREATE OR REPLACE — 추가/치환만, 하위호환.
-- 복구: 129/130 의 함수 정의로 CREATE OR REPLACE 재적용.
-- ============================================================

-- ─── invite_to_team (TEAM_INVITE) ──────────────────────────
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
      '/programs/' || v_program || '?tab=ranking&team=1',
      v_uid, 'team_invites', v_invite_id
    );
  END IF;

  RETURN v_invite_id;
END;
$$;

-- ─── respond_team_invite (TEAM_JOINED → 팀장) ───────────────
CREATE OR REPLACE FUNCTION public.respond_team_invite(
  p_invite_id UUID,
  p_accept BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_team UUID;
  v_invitee UUID;
  v_status TEXT;
  v_program UUID;
  v_leader UUID;
  v_capacity INT;
  v_name TEXT;
  v_count INT;
  v_member TEXT;
BEGIN
  SELECT team_id, invitee_id, status
    INTO v_team, v_invitee, v_status
  FROM public.team_invites WHERE id = p_invite_id;

  IF v_team IS NULL THEN RAISE EXCEPTION '초대를 찾을 수 없어요'; END IF;
  IF v_invitee <> v_uid THEN RAISE EXCEPTION '본인에게 온 초대만 응답할 수 있어요'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION '이미 처리된 초대예요'; END IF;

  SELECT program_id, leader_id, capacity, name
    INTO v_program, v_leader, v_capacity, v_name
  FROM public.teams WHERE id = v_team;

  IF NOT p_accept THEN
    UPDATE public.team_invites SET status = 'declined' WHERE id = p_invite_id;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.team_members
    WHERE program_id = v_program AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION '이미 팀에 속해 있어요';
  END IF;

  SELECT count(*) INTO v_count FROM public.team_members WHERE team_id = v_team;
  IF v_count >= v_capacity THEN RAISE EXCEPTION '팀 정원이 가득 찼어요'; END IF;

  INSERT INTO public.team_members (team_id, program_id, user_id)
  VALUES (v_team, v_program, v_uid);

  UPDATE public.team_invites SET status = 'accepted' WHERE id = p_invite_id;

  UPDATE public.team_invites ti SET status = 'declined'
  FROM public.teams t
  WHERE ti.team_id = t.id
    AND t.program_id = v_program
    AND ti.invitee_id = v_uid
    AND ti.status = 'pending'
    AND ti.id <> p_invite_id;

  SELECT nickname INTO v_member FROM public.users WHERE id = v_uid;
  IF v_leader <> v_uid AND public.is_notification_enabled(v_leader, 'TEAM_JOINED') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
    VALUES (
      v_leader, 'TEAM_JOINED', '🎉 새 팀원이 합류했어요',
      COALESCE(v_member, '누군가') || '님이 ''' || v_name || ''' 팀에 합류했어요',
      '/programs/' || v_program || '?tab=ranking&team=1',
      v_uid, 'teams', v_team
    );
  END IF;
END;
$$;

-- ─── remove_team_member (TEAM_REMOVED) ─────────────────────
CREATE OR REPLACE FUNCTION public.remove_team_member(
  p_team_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_leader UUID;
  v_program UUID;
  v_name TEXT;
BEGIN
  SELECT leader_id, program_id, name INTO v_leader, v_program, v_name
  FROM public.teams WHERE id = p_team_id;

  IF v_leader IS NULL THEN RAISE EXCEPTION '팀을 찾을 수 없어요'; END IF;
  IF v_leader <> v_uid THEN RAISE EXCEPTION '팀장만 팀원을 내보낼 수 있어요'; END IF;
  IF p_user_id = v_uid THEN RAISE EXCEPTION '팀장은 내보내기 대신 팀 나가기를 이용해요'; END IF;

  DELETE FROM public.team_members
  WHERE team_id = p_team_id AND user_id = p_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION '팀원이 아니에요'; END IF;

  IF public.is_notification_enabled(p_user_id, 'TEAM_REMOVED') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
    VALUES (
      p_user_id, 'TEAM_REMOVED', '팀에서 나오게 되었어요',
      '''' || v_name || ''' 팀에서 나오게 되었어요. 다른 팀에 새로 합류할 수 있어요.',
      '/programs/' || v_program || '?tab=ranking&team=1',
      'teams', p_team_id
    );
  END IF;
END;
$$;

-- ─── leave_team (TEAM_LEADER_CHANGED → 새 팀장) ─────────────
CREATE OR REPLACE FUNCTION public.leave_team(
  p_team_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_leader UUID;
  v_program UUID;
  v_name TEXT;
  v_next UUID;
BEGIN
  SELECT leader_id, program_id, name INTO v_leader, v_program, v_name
  FROM public.teams WHERE id = p_team_id;

  IF v_leader IS NULL THEN RAISE EXCEPTION '팀을 찾을 수 없어요'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION '이 팀의 팀원이 아니에요';
  END IF;

  IF v_leader = v_uid THEN
    SELECT user_id INTO v_next
    FROM public.team_members
    WHERE team_id = p_team_id AND user_id <> v_uid
    ORDER BY joined_at ASC, id ASC
    LIMIT 1;

    IF v_next IS NULL THEN
      DELETE FROM public.teams WHERE id = p_team_id;
      RETURN;
    END IF;

    UPDATE public.teams SET leader_id = v_next WHERE id = p_team_id;
    DELETE FROM public.team_members WHERE team_id = p_team_id AND user_id = v_uid;

    IF public.is_notification_enabled(v_next, 'TEAM_LEADER_CHANGED') THEN
      INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
      VALUES (
        v_next, 'TEAM_LEADER_CHANGED', '👑 팀장이 되었어요',
        '''' || v_name || ''' 팀의 새 팀장이 되었어요.',
        '/programs/' || v_program || '?tab=ranking&team=1',
        'teams', p_team_id
      );
    END IF;
    RETURN;
  END IF;

  DELETE FROM public.team_members WHERE team_id = p_team_id AND user_id = v_uid;
END;
$$;

-- ─── transfer_team_leader (TEAM_LEADER_CHANGED → 새 팀장) ────
CREATE OR REPLACE FUNCTION public.transfer_team_leader(
  p_team_id UUID,
  p_new_leader_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_leader UUID;
  v_program UUID;
  v_name TEXT;
BEGIN
  SELECT leader_id, program_id, name INTO v_leader, v_program, v_name
  FROM public.teams WHERE id = p_team_id;

  IF v_leader IS NULL THEN RAISE EXCEPTION '팀을 찾을 수 없어요'; END IF;
  IF v_leader <> v_uid THEN RAISE EXCEPTION '팀장만 위임할 수 있어요'; END IF;
  IF p_new_leader_id = v_uid THEN RAISE EXCEPTION '이미 팀장이에요'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = p_new_leader_id
  ) THEN
    RAISE EXCEPTION '팀원에게만 위임할 수 있어요';
  END IF;

  UPDATE public.teams SET leader_id = p_new_leader_id WHERE id = p_team_id;

  IF public.is_notification_enabled(p_new_leader_id, 'TEAM_LEADER_CHANGED') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
    VALUES (
      p_new_leader_id, 'TEAM_LEADER_CHANGED', '👑 팀장이 되었어요',
      '''' || v_name || ''' 팀의 새 팀장이 되었어요.',
      '/programs/' || v_program || '?tab=ranking&team=1',
      'teams', p_team_id
    );
  END IF;
END;
$$;
