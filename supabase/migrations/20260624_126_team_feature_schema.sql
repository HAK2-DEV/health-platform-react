-- ============================================================
-- Migration: 126 - 팀 기능 1단계 스키마 (teams / team_members / team_invites)
-- 작성일: 2026-06-24
-- 설명:
--   참여자끼리 팀을 구성하는 기능의 기반 스키마. 전부 추가(additive)이며
--   기존 동작에 영향 없음(team_enabled 기본 false → 미설정 프로그램은 그대로).
--   설계 확정본: 메모리 project_team_feature_design_2026-06-24.
--
--   (1) programs 에 팀 설정 컬럼 추가:
--       team_enabled    - 팀 기능 사용 여부 (기본 false)
--       team_score_mode - 'sum'(합계+평균 보조) | 'average'(평균만). 정렬·강조 기준
--       team_size_type  - 'range'(팀장이 min~max 안에서 정원 선택) | 'fixed'(정원 고정)
--       team_size_min/max - 범위형 하한(=랭킹 반영 최소, 기본 2)·상한(≤8)
--       team_size_fixed - 고정형 정원
--   (2) teams       - 팀. leader_id 가 팀장 단일 진실원천(위임 시 이 값만 갱신).
--                     capacity = 이 팀의 정원(범위형은 팀장 선택, 고정형은 설정값).
--   (3) team_members - 팀 소속. UNIQUE(program_id,user_id) 로 1인 1팀 보장.
--                      팀장도 자신의 team_members 행을 가짐(생성 시 자동 합류).
--   (4) team_invites - 앱 내 초대(초대 전용 모델). status pending/accepted/declined.
--
--   팀 점수는 저장하지 않음 — team_members 의 개인 점수를 항상 라이브 집계.
--   정원 초과는 capacity 가드 트리거로 DB 레벨 차단. 합류는 RLS 로 초대 전용 강제.
--
-- 복구:
--   DROP TABLE public.team_invites, public.team_members, public.teams CASCADE;
--   DROP FUNCTION public.team_member_capacity_guard();
--   ALTER TABLE public.programs
--     DROP COLUMN team_enabled, DROP COLUMN team_score_mode,
--     DROP COLUMN team_size_type, DROP COLUMN team_size_min,
--     DROP COLUMN team_size_max, DROP COLUMN team_size_fixed;
-- ============================================================

-- ─── 1) programs 팀 설정 컬럼 (additive) ─────────────────────
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS team_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS team_score_mode TEXT
    CHECK (team_score_mode IS NULL OR team_score_mode IN ('sum', 'average'));
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS team_size_type TEXT
    CHECK (team_size_type IS NULL OR team_size_type IN ('range', 'fixed'));
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS team_size_min INT;
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS team_size_max INT;
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS team_size_fixed INT;

-- ─── 2) teams ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT,                                       -- 팀 표식(이모지/색) 선택
  leader_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  capacity INT NOT NULL CHECK (capacity >= 2 AND capacity <= 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_program ON public.teams(program_id);
CREATE INDEX IF NOT EXISTS idx_teams_leader ON public.teams(leader_id);

-- ─── 3) team_members (1인 1팀 보장) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, user_id)                      -- 한 프로그램에서 한 팀만
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(program_id, user_id);

-- ─── 4) team_invites (앱 내 초대) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_invites_invitee ON public.team_invites(invitee_id, status);
CREATE INDEX IF NOT EXISTS idx_team_invites_team ON public.team_invites(team_id);
-- 같은 사람에게 중복 pending 초대 방지
CREATE UNIQUE INDEX IF NOT EXISTS uniq_team_invite_pending
  ON public.team_invites(team_id, invitee_id) WHERE status = 'pending';

-- ─── 5) 정원 초과 차단 가드 (DB 레벨 안전망) ────────────────
CREATE OR REPLACE FUNCTION public.team_member_capacity_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_capacity INT;
  v_count INT;
BEGIN
  SELECT capacity INTO v_capacity FROM public.teams WHERE id = NEW.team_id;
  SELECT count(*) INTO v_count FROM public.team_members WHERE team_id = NEW.team_id;
  IF v_count >= COALESCE(v_capacity, 0) THEN
    RAISE EXCEPTION 'team is full (capacity %)', v_capacity
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_member_capacity ON public.team_members;
CREATE TRIGGER team_member_capacity
  BEFORE INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.team_member_capacity_guard();

-- ─── 6) RLS: teams ──────────────────────────────────────────
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- 읽기: 운영자 / 같은 프로그램 활성 참여자 (팀 랭킹·목록 조회)
DROP POLICY IF EXISTS "teams select" ON public.teams;
CREATE POLICY "teams select" ON public.teams
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.owner_id = auth.uid())
  OR public._is_active_participant(program_id, auth.uid())
);

-- 생성: 활성 참여자가 본인을 팀장으로 (1인1팀은 team_members UNIQUE 가 최종 보장)
DROP POLICY IF EXISTS "teams insert" ON public.teams;
CREATE POLICY "teams insert" ON public.teams
FOR INSERT TO authenticated
WITH CHECK (
  leader_id = auth.uid()
  AND public._is_active_participant(program_id, auth.uid())
);

-- 수정: 팀장(이름·정원·위임) / 운영자
DROP POLICY IF EXISTS "teams update" ON public.teams;
CREATE POLICY "teams update" ON public.teams
FOR UPDATE TO authenticated
USING (
  leader_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.owner_id = auth.uid())
)
WITH CHECK (
  leader_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.owner_id = auth.uid())
);

-- 삭제(해체): 팀장 / 운영자
DROP POLICY IF EXISTS "teams delete" ON public.teams;
CREATE POLICY "teams delete" ON public.teams
FOR DELETE TO authenticated
USING (
  leader_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.owner_id = auth.uid())
);

-- ─── 7) RLS: team_members ───────────────────────────────────
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 읽기: 운영자 / 같은 프로그램 활성 참여자 (팀 명단·점수 집계)
DROP POLICY IF EXISTS "team_members select" ON public.team_members;
CREATE POLICY "team_members select" ON public.team_members
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.owner_id = auth.uid())
  OR public._is_active_participant(program_id, auth.uid())
);

-- 합류: 본인만, 활성 참여자, 그리고 (팀장 자기합류 OR 받은 pending 초대 보유) — 초대 전용 강제
DROP POLICY IF EXISTS "team_members insert" ON public.team_members;
CREATE POLICY "team_members insert" ON public.team_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public._is_active_participant(program_id, auth.uid())
  AND (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.leader_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.team_invites ti
      WHERE ti.team_id = team_id AND ti.invitee_id = auth.uid() AND ti.status = 'pending'
    )
  )
);

-- 탈퇴/추방: 본인(자진 탈퇴) / 팀장(추방) / 운영자
DROP POLICY IF EXISTS "team_members delete" ON public.team_members;
CREATE POLICY "team_members delete" ON public.team_members
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.leader_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.owner_id = auth.uid())
);

-- ─── 8) RLS: team_invites ───────────────────────────────────
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- 읽기: 받은 사람 / 보낸 사람 / 팀장 / 운영자
DROP POLICY IF EXISTS "team_invites select" ON public.team_invites;
CREATE POLICY "team_invites select" ON public.team_invites
FOR SELECT TO authenticated
USING (
  invitee_id = auth.uid()
  OR inviter_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.leader_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.teams t JOIN public.programs p ON p.id = t.program_id
    WHERE t.id = team_id AND p.owner_id = auth.uid()
  )
);

-- 발송: 팀장 본인이, 같은 프로그램 활성 참여자에게
DROP POLICY IF EXISTS "team_invites insert" ON public.team_invites;
CREATE POLICY "team_invites insert" ON public.team_invites
FOR INSERT TO authenticated
WITH CHECK (
  inviter_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_id AND t.leader_id = auth.uid()
      AND public._is_active_participant(t.program_id, invitee_id)
  )
);

-- 수정(수락/거절): 받은 사람 / (취소) 팀장·보낸 사람
DROP POLICY IF EXISTS "team_invites update" ON public.team_invites;
CREATE POLICY "team_invites update" ON public.team_invites
FOR UPDATE TO authenticated
USING (
  invitee_id = auth.uid()
  OR inviter_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.leader_id = auth.uid())
)
WITH CHECK (
  invitee_id = auth.uid()
  OR inviter_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.leader_id = auth.uid())
);

-- 삭제: 팀장 / 보낸 사람
DROP POLICY IF EXISTS "team_invites delete" ON public.team_invites;
CREATE POLICY "team_invites delete" ON public.team_invites
FOR DELETE TO authenticated
USING (
  inviter_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.leader_id = auth.uid())
);
