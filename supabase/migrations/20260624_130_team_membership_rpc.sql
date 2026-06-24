-- ============================================================
-- Migration: 130 - 팀장 권한 RPC 3종 (추방/탈퇴/위임) + 알림 타입 2종
-- 작성일: 2026-06-24
-- 설명:
--   팀 상세 화면의 멤버 관리 동작을 서버측에서 원자적으로 처리.
--
--   1) notifications.type 에 'TEAM_REMOVED'(내보내짐)·'TEAM_LEADER_CHANGED'(팀장 승계) 추가.
--   2) remove_team_member(team_id, user_id) — 팀장이 팀원 내보내기(추방).
--        팀장 본인은 불가(탈퇴를 쓰도록). 내보내진 사람에게 중립 알림.
--   3) leave_team(team_id) — 본인 자진 탈퇴.
--        팀장이 나갈 때: 남은 멤버 있으면 가장 먼저 합류한 사람에게 자동 승계
--        (새 팀장에게 알림), 혼자였으면 팀 자동 해체(teams 삭제 → 멤버/초대 CASCADE).
--   4) transfer_team_leader(team_id, new_leader_id) — 팀장이 명시적으로 위임.
--        새 팀장은 현재 팀원이어야 함. teams.leader_id 갱신 + 새 팀장에게 알림.
--
--   모두 SECURITY DEFINER. auth.uid() 기준 검증. 추가만(하위호환).
--
-- 복구:
--   DROP FUNCTION public.remove_team_member(UUID, UUID);
--   DROP FUNCTION public.leave_team(UUID);
--   DROP FUNCTION public.transfer_team_leader(UUID, UUID);
--   (type CHECK 는 TEAM_* 알림행 정리 후 129 시점으로 되돌림)
-- ============================================================

-- ─── 1) notifications.type CHECK 확장 ──────────────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'REVIEW_APPROVED', 'REVIEW_REJECTED', 'POST_LIKE', 'POST_COMMENT',
    'PARTICIPANT_JOINED', 'VERIFICATION_SUBMITTED', 'POST_PENDING',
    'POST_APPROVED', 'POST_REJECTED', 'REPORT_RECEIVED',
    'TEAM_INVITE', 'TEAM_JOINED', 'TEAM_REMOVED', 'TEAM_LEADER_CHANGED'
  ));

-- ─── 2) 추방 ─────────────────────────────────────────────────
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
      '/rankings?program=' || v_program || '&teamtab=1',
      'teams', p_team_id
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.remove_team_member(UUID, UUID) TO authenticated;

-- ─── 3) 자진 탈퇴 (+ 팀장 자동 승계/해체) ────────────────────
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

  -- 팀장이 나가는 경우
  IF v_leader = v_uid THEN
    SELECT user_id INTO v_next
    FROM public.team_members
    WHERE team_id = p_team_id AND user_id <> v_uid
    ORDER BY joined_at ASC, id ASC
    LIMIT 1;

    IF v_next IS NULL THEN
      -- 혼자였음 → 팀 해체 (members/invites CASCADE)
      DELETE FROM public.teams WHERE id = p_team_id;
      RETURN;
    END IF;

    -- 남은 멤버 중 최선임에게 승계
    UPDATE public.teams SET leader_id = v_next WHERE id = p_team_id;
    DELETE FROM public.team_members WHERE team_id = p_team_id AND user_id = v_uid;

    IF public.is_notification_enabled(v_next, 'TEAM_LEADER_CHANGED') THEN
      INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
      VALUES (
        v_next, 'TEAM_LEADER_CHANGED', '👑 팀장이 되었어요',
        '''' || v_name || ''' 팀의 새 팀장이 되었어요.',
        '/rankings?program=' || v_program || '&teamtab=1',
        'teams', p_team_id
      );
    END IF;
    RETURN;
  END IF;

  -- 일반 팀원 탈퇴
  DELETE FROM public.team_members WHERE team_id = p_team_id AND user_id = v_uid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.leave_team(UUID) TO authenticated;

-- ─── 4) 팀장 위임 ────────────────────────────────────────────
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
      '/rankings?program=' || v_program || '&teamtab=1',
      'teams', p_team_id
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.transfer_team_leader(UUID, UUID) TO authenticated;
