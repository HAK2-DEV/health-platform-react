-- ============================================================
-- Migration: 133 - 초대 후보 정렬을 닉네임순으로 고정 (위치 유지)
-- 작성일: 2026-06-24
-- 설명:
--   get_team_invite_candidates(129) 가 'invited ASC, nickname' 으로 정렬해서
--   초대 직후 새로고침되면 그 사람이 목록 맨 아래로 내려갔다. 닉네임순으로만
--   정렬하도록 변경 → 초대해도 위치 유지, 버튼만 '초대됨'으로 바뀜.
--
--   ORDER BY 만 변경(로직 동일). CREATE OR REPLACE — 치환만, 하위호환.
-- 복구: 129 정의로 재적용.
-- ============================================================

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
    AND t.leader_id = auth.uid()
    AND u.id <> t.leader_id
    AND NOT EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.program_id = t.program_id AND tm.user_id = u.id
    )
  ORDER BY u.nickname;
$$;
