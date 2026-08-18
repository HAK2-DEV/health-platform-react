-- ============================================================
-- Migration: 234 - 이탈 조짐 참여자 집계 RPC (get_at_risk_participants)
-- 작성일: 2026-08-18
-- 설명:
--   운영자 "이탈 관리 리마인드"용 — ACTIVE 참여자 중 마지막 인증(verifications.submitted_at)이
--   임계일(기본 3일) 이상 지난 사람을 집계. 인증이 한 번도 없으면 joined_at 기준(신규는 유예).
--   프로그램 소유자 또는 admin 만 호출 가능(SECURITY DEFINER, RLS 우회 집계). 운영자 본인은 제외.
--   반환: (user_id, nickname, last_active_at, days_since) — 오래된 순(위험 큰 순).
--
--   임계일은 파라미터(p_threshold_days)로 받아 추후 운영자 커스텀 설정 여지를 둠(기본 3).
--
-- 복구:
--   DROP FUNCTION IF EXISTS public.get_at_risk_participants(uuid, int);
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_at_risk_participants(
  p_program_id uuid,
  p_threshold_days int DEFAULT 3
)
RETURNS TABLE(user_id uuid, nickname text, last_active_at timestamptz, days_since int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT p.owner_id INTO v_owner FROM programs p WHERE p.id = p_program_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'program not found';
  END IF;
  -- 운영자 또는 관리자만
  IF v_owner <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  WITH active AS (
    SELECT pp.user_id, pp.joined_at
    FROM program_participants pp
    WHERE pp.program_id = p_program_id
      AND pp.status = 'ACTIVE'
      AND pp.user_id <> v_owner            -- 운영자 본인 제외
  ),
  last_verif AS (
    SELECT v.user_id, MAX(v.submitted_at) AS last_at
    FROM verifications v
    JOIN missions m ON m.id = v.mission_id
    WHERE m.program_id = p_program_id
    GROUP BY v.user_id
  )
  SELECT
    a.user_id,
    COALESCE(u.nickname, '(알 수 없음)') AS nickname,
    lv.last_at AS last_active_at,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - COALESCE(lv.last_at, a.joined_at))) / 86400))::int AS days_since
  FROM active a
  LEFT JOIN last_verif lv ON lv.user_id = a.user_id
  LEFT JOIN users u ON u.id = a.user_id
  WHERE COALESCE(lv.last_at, a.joined_at) <= now() - make_interval(days => GREATEST(1, p_threshold_days))
  ORDER BY COALESCE(lv.last_at, a.joined_at) ASC;   -- 가장 오래된(위험 큰) 먼저
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_at_risk_participants(uuid, int) TO authenticated;
