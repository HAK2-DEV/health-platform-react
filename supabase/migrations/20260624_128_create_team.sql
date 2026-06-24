-- ============================================================
-- Migration: 128 - 팀 생성 RPC (create_team)
-- 작성일: 2026-06-24
-- 설명:
--   팀 생성을 원자적으로 처리. teams INSERT + team_members INSERT(팀장 자동 합류)를
--   한 트랜잭션으로 묶어 "멤버 없는 팀"이 남지 않게 함. 서버측에서 규칙 검증:
--     - 프로그램 team_enabled = true
--     - 호출자가 해당 프로그램의 ACTIVE 참여자
--     - 1인 1팀 (이미 팀 소속이면 거부)
--     - 정원(capacity)이 정책에 부합:
--         fixed → team_size_fixed 로 강제
--         range → team_size_min ~ team_size_max 범위 안
--   반환: 새 팀 id.
--
--   SECURITY DEFINER (RLS 우회)이므로 auth.uid() 기준으로 직접 검증.
--   추가만 — 기존 동작에 영향 없음.
--
-- 복구: DROP FUNCTION public.create_team(UUID, TEXT, TEXT, INT);
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_team(
  p_program_id UUID,
  p_name TEXT,
  p_emoji TEXT,
  p_capacity INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_enabled BOOLEAN;
  v_size_type TEXT;
  v_size_min INT;
  v_size_max INT;
  v_size_fixed INT;
  v_capacity INT;
  v_team_id UUID;
  v_name TEXT := btrim(COALESCE(p_name, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요해요';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION '팀 이름을 입력해주세요';
  END IF;
  IF char_length(v_name) > 20 THEN
    RAISE EXCEPTION '팀 이름은 최대 20자예요';
  END IF;

  SELECT team_enabled, COALESCE(team_size_type, 'range'),
         COALESCE(team_size_min, 2), COALESCE(team_size_max, 8), team_size_fixed
    INTO v_enabled, v_size_type, v_size_min, v_size_max, v_size_fixed
  FROM public.programs
  WHERE id = p_program_id;

  IF NOT COALESCE(v_enabled, false) THEN
    RAISE EXCEPTION '이 프로그램은 팀 기능이 켜져 있지 않아요';
  END IF;

  IF NOT public._is_active_participant(p_program_id, v_uid) THEN
    RAISE EXCEPTION '이 프로그램의 참여자만 팀을 만들 수 있어요';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.team_members
    WHERE program_id = p_program_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION '이미 팀에 속해 있어요. 한 프로그램에서는 한 팀만 가능해요';
  END IF;

  -- 정원 정책 검증·보정
  IF v_size_type = 'fixed' THEN
    v_capacity := COALESCE(v_size_fixed, 2);
  ELSE
    v_capacity := p_capacity;
    IF v_capacity IS NULL OR v_capacity < v_size_min OR v_capacity > v_size_max THEN
      RAISE EXCEPTION '팀 정원은 % ~ %명 사이여야 해요', v_size_min, v_size_max;
    END IF;
  END IF;

  INSERT INTO public.teams (program_id, name, emoji, leader_id, capacity)
  VALUES (p_program_id, v_name, NULLIF(btrim(COALESCE(p_emoji, '')), ''), v_uid, v_capacity)
  RETURNING id INTO v_team_id;

  INSERT INTO public.team_members (team_id, program_id, user_id)
  VALUES (v_team_id, p_program_id, v_uid);

  RETURN v_team_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_team(UUID, TEXT, TEXT, INT) TO authenticated;
