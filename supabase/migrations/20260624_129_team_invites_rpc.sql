-- ============================================================
-- Migration: 129 - 팀 초대 RPC 3종 + 알림 타입 2종 (앱 내 초대)
-- 작성일: 2026-06-24
-- 설명:
--   초대 전용(invite-only) 모델의 앱 내 초대 흐름을 서버측에서 원자적으로 처리.
--   채팅 없이, 같은 프로그램 참여자 목록에서 골라 초대 → 알림 → 수락/거절.
--
--   1) notifications.type CHECK 에 'TEAM_INVITE'(초대받음)·'TEAM_JOINED'(합류 알림) 추가.
--      is_notification_enabled() 의 ELSE TRUE 분기로 기본 발송(전용 선호 컬럼 불필요).
--   2) invite_to_team(team_id, invitee_id) — 팀장이 발송.
--        검증: 팀장 본인 / 초대 대상이 ACTIVE 참여자 / 미소속 / 정원 여유 / 중복 pending 금지.
--        → team_invites INSERT + 초대 대상에게 TEAM_INVITE 알림. 반환: invite_id.
--   3) respond_team_invite(invite_id, accept) — 받은 사람이 수락/거절.
--        수락: 1인1팀·정원 재확인 → team_members INSERT → 같은 프로그램의 다른 pending
--              초대 자동 거절 → 팀장에게 TEAM_JOINED 알림.
--        거절: status='declined'.
--   4) get_team_invite_candidates(team_id) — 팀장이 초대할 수 있는 후보 목록.
--        같은 프로그램 ACTIVE 참여자 중 아직 어느 팀에도 없는 사람 + 이미 초대했는지(invited).
--
--   모두 SECURITY DEFINER (RLS 우회) — auth.uid() 기준 직접 검증. 추가만(하위호환).
--
-- 복구:
--   DROP FUNCTION public.invite_to_team(UUID, UUID);
--   DROP FUNCTION public.respond_team_invite(UUID, BOOLEAN);
--   DROP FUNCTION public.get_team_invite_candidates(UUID);
--   (type CHECK 는 110/115 와 동일 패턴으로 되돌리되 TEAM_* 알림행 먼저 정리)
-- ============================================================

-- ─── 1) notifications.type CHECK 확장 (TEAM_INVITE / TEAM_JOINED 추가) ──────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'REVIEW_APPROVED', 'REVIEW_REJECTED', 'POST_LIKE', 'POST_COMMENT',
    'PARTICIPANT_JOINED', 'VERIFICATION_SUBMITTED', 'POST_PENDING',
    'POST_APPROVED', 'POST_REJECTED', 'REPORT_RECEIVED',
    'TEAM_INVITE', 'TEAM_JOINED'
  ));

-- ─── 2) 초대 발송 ────────────────────────────────────────────
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
      '/rankings?program=' || v_program || '&teamtab=1',
      v_uid, 'team_invites', v_invite_id
    );
  END IF;

  RETURN v_invite_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.invite_to_team(UUID, UUID) TO authenticated;

-- ─── 3) 초대 응답 (수락/거절) ────────────────────────────────
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

  -- 거절
  IF NOT p_accept THEN
    UPDATE public.team_invites SET status = 'declined' WHERE id = p_invite_id;
    RETURN;
  END IF;

  -- 수락
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

  -- 같은 프로그램의 다른 pending 초대 자동 거절
  UPDATE public.team_invites ti SET status = 'declined'
  FROM public.teams t
  WHERE ti.team_id = t.id
    AND t.program_id = v_program
    AND ti.invitee_id = v_uid
    AND ti.status = 'pending'
    AND ti.id <> p_invite_id;

  -- 팀장에게 합류 알림
  SELECT nickname INTO v_member FROM public.users WHERE id = v_uid;
  IF v_leader <> v_uid AND public.is_notification_enabled(v_leader, 'TEAM_JOINED') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
    VALUES (
      v_leader, 'TEAM_JOINED', '🎉 새 팀원이 합류했어요',
      COALESCE(v_member, '누군가') || '님이 ''' || v_name || ''' 팀에 합류했어요',
      '/rankings?program=' || v_program || '&teamtab=1',
      v_uid, 'teams', v_team
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.respond_team_invite(UUID, BOOLEAN) TO authenticated;

-- ─── 4) 초대 후보 목록 (팀장 전용) ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_team_invite_candidates(
  p_team_id UUID
)
RETURNS TABLE (
  user_id UUID,
  nickname TEXT,
  avatar_path TEXT,
  invited BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id AS user_id,
    u.nickname,
    u.avatar_path,
    EXISTS (
      SELECT 1 FROM public.team_invites ti
      WHERE ti.team_id = p_team_id AND ti.invitee_id = u.id AND ti.status = 'pending'
    ) AS invited
  FROM public.teams t
  JOIN public.program_participants pp
    ON pp.program_id = t.program_id AND pp.status = 'ACTIVE'
  JOIN public.users u ON u.id = pp.user_id
  WHERE t.id = p_team_id
    AND t.leader_id = auth.uid()          -- 팀장만 (아니면 빈 결과)
    AND u.id <> t.leader_id               -- 본인 제외
    AND NOT EXISTS (                      -- 이미 어느 팀에든 속한 사람 제외
      SELECT 1 FROM public.team_members tm
      WHERE tm.program_id = t.program_id AND tm.user_id = u.id
    )
  ORDER BY invited ASC, u.nickname;
$$;
GRANT EXECUTE ON FUNCTION public.get_team_invite_candidates(UUID) TO authenticated;
