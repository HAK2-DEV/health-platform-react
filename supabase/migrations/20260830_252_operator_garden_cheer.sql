-- ============================================================
-- Migration: 252 - 운영자가 참여자에게 보내는 응원 나비
-- 작성일: 2026-08-30
-- 설명:
--   250 의 응원 나비를 운영자도 보낼 수 있게 한다.
--   아직 참여자에게 노출하지 않는 개발 단계 기능(/dev/growth 전용).
--
--   ▸ 운영자는 «참여자가 아닐 수 있다»
--     운영자는 programs.owner_id 로 판별한다(165 의 send_operator_cheer 와 같은 기준).
--     참여자로 등록돼 있지 않으면 정원에 자기 꽃이 없고, 따라서 «돌아오는 나비» 보상도 없다.
--     그래도 된다 — 운영자의 보상은 점수가 아니라 «참여자가 돌아오는 것» 이다.
--     운영자가 참여자이기도 하면 자기 꽃에 보상이 그대로 들어온다(from_points).
--
--   ▸ 한도가 다른 이유
--     참여자 3마리 / 운영자 10마리. 참여자가 수십 명이어도 «오늘 챙길 사람» 을 고르기엔 충분하고,
--     전원에게 매일 뿌리지 못하게 막는다 — 희소해야 받았을 때 의미가 생긴다.
--     같은 사람에겐 하루 1마리(250 의 유니크 인덱스가 그대로 적용된다).
--
--   ▸ 인플레는 생기지 않는다
--     나비는 점수를 «주지» 않는다. 받는 사람이 «다음에 인증할 때» 힘을 보탤 뿐이고,
--     그 상한도 한 번에 3점으로 250 과 동일하다. 운영자가 아무리 보내도
--     참여자가 실제로 인증하지 않으면 아무 점수도 생기지 않는다.
--
-- 하위호환:
--   · is_operator 컬럼 추가(DEFAULT false) — 기존 행은 전부 false 로 읽힌다.
--   · send_garden_cheer 는 «자격을 넓히는» 방향으로만 바꾼다. 참여자 경로는 그대로다.
--   · get_my_garden_cheers 에 컬럼 1개 추가 — 기존 클라이언트는 무시하므로 그대로 동작한다.
--
-- 복구:
--   supabase/rollbacks/252_revert_operator_garden_cheer.sql 수동 실행.
-- ============================================================

ALTER TABLE public.garden_cheers
  ADD COLUMN IF NOT EXISTS is_operator BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.garden_cheers.is_operator IS
  '운영자 자격으로 보낸 응원인가. 화면에서 금색 나비로 구분하고 하루 한도가 다르다.';

-- ─── 보내기 — 운영자 자격을 추가 ──────────────────────────────
CREATE OR REPLACE FUNCTION public.send_garden_cheer(
  p_program_id  UUID,
  p_to_user_id  UUID
)
RETURNS INT                       -- 오늘 남은 마릿수
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me      UUID := auth.uid();
  v_owner   UUID;
  v_is_op   BOOLEAN;
  v_limit   INT;
  v_today   INT;
  v_dormant BOOLEAN;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;
  IF v_me = p_to_user_id THEN
    RAISE EXCEPTION '자기 자신에게는 보낼 수 없습니다.';
  END IF;

  SELECT owner_id INTO v_owner FROM public.programs WHERE id = p_program_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION '프로그램을 찾을 수 없습니다.';
  END IF;

  -- 운영자(또는 관리자)이면 참여자가 아니어도 보낼 수 있다. 한도만 달라진다.
  v_is_op := (v_me = v_owner) OR public.is_admin();
  v_limit := CASE WHEN v_is_op THEN 10 ELSE 3 END;

  IF NOT v_is_op AND NOT public._is_active_participant(p_program_id, v_me) THEN
    RAISE EXCEPTION '참여 중인 프로그램에서만 응원을 보낼 수 있습니다.';
  END IF;
  -- 받는 사람은 언제나 그 프로그램의 활성 참여자여야 한다
  IF NOT public._is_active_participant(p_program_id, p_to_user_id) THEN
    RAISE EXCEPTION '그 프로그램의 참여자가 아닙니다.';
  END IF;

  SELECT COUNT(*) INTO v_today
  FROM public.garden_cheers
  WHERE program_id = p_program_id
    AND from_user_id = v_me
    AND (created_at AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date;

  IF v_today >= v_limit THEN
    RAISE EXCEPTION '오늘 보낼 수 있는 나비를 다 썼어요.';
  END IF;

  -- ⚠️ 휴면 판정은 «지금» 해서 박아둔다. 닿는 건 나중이라 그때 재면 이미 휴면이 아니다.
  v_dormant := NOT EXISTS (
    SELECT 1
    FROM public.verifications v
    JOIN public.missions m ON m.id = v.mission_id
    WHERE m.program_id = p_program_id
      AND v.user_id = p_to_user_id
      AND v.status = 'APPROVED'
      AND (v.submitted_at AT TIME ZONE 'Asia/Seoul')::date
          >= (now() AT TIME ZONE 'Asia/Seoul')::date - 3
  );

  BEGIN
    INSERT INTO public.garden_cheers (program_id, from_user_id, to_user_id, was_dormant, is_operator)
    VALUES (p_program_id, v_me, p_to_user_id, v_dormant, v_is_op);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION '오늘 이미 응원을 보냈어요.';
  END;

  RETURN v_limit - (v_today + 1);
END;
$$;

REVOKE ALL ON FUNCTION public.send_garden_cheer(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_garden_cheer(UUID, UUID) TO authenticated;

-- ─── 내 응원 목록 — 운영자 여부와 «오늘 남은 수» 를 알 수 있게 ──
DROP FUNCTION IF EXISTS public.get_my_garden_cheers(UUID);

CREATE FUNCTION public.get_my_garden_cheers(p_program_id UUID)
RETURNS TABLE (
  id          UUID,
  direction   TEXT,        -- 'in' = 내가 받은 것, 'out' = 내가 보낸 것
  other_id    UUID,
  nickname    TEXT,
  avatar_path TEXT,
  was_dormant BOOLEAN,
  is_operator BOOLEAN,     -- 운영자가 보낸 응원인가(금색 나비)
  created_at  TIMESTAMPTZ,
  landed_at   TIMESTAMPTZ,
  points      INT          -- 이 응원으로 «내가» 얻은 점수
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, 'in'::text, c.from_user_id, u.nickname, u.avatar_path,
         c.was_dormant, c.is_operator, c.created_at, c.landed_at, c.to_points
  FROM public.garden_cheers c
  JOIN public.users u ON u.id = c.from_user_id
  WHERE c.program_id = p_program_id AND c.to_user_id = auth.uid()
  UNION ALL
  SELECT c.id, 'out'::text, c.to_user_id, u.nickname, u.avatar_path,
         c.was_dormant, c.is_operator, c.created_at, c.landed_at, c.from_points
  FROM public.garden_cheers c
  JOIN public.users u ON u.id = c.to_user_id
  WHERE c.program_id = p_program_id AND c.from_user_id = auth.uid()
  ORDER BY 8 DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_garden_cheers(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_garden_cheers(UUID) TO authenticated;

-- ─── 내가 이 프로그램에서 오늘 몇 마리 더 보낼 수 있나 ──────────
--   화면이 «남은 수» 를 보여주려면 한도 규칙(참여자 3 / 운영자 10)을 알아야 한다.
--   그 규칙을 클라이언트에 복사해두면 언젠가 서로 어긋난다 — 서버가 한 번에 알려준다.
CREATE OR REPLACE FUNCTION public.get_my_cheer_quota(p_program_id UUID)
RETURNS TABLE (is_operator BOOLEAN, daily_limit INT, used_today INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH op AS (
    SELECT ((SELECT owner_id FROM public.programs WHERE id = p_program_id) = auth.uid())
           OR public.is_admin() AS v
  )
  SELECT op.v,
         CASE WHEN op.v THEN 10 ELSE 3 END,
         (SELECT COUNT(*)::int FROM public.garden_cheers
           WHERE program_id = p_program_id
             AND from_user_id = auth.uid()
             AND (created_at AT TIME ZONE 'Asia/Seoul')::date
                 = (now() AT TIME ZONE 'Asia/Seoul')::date)
  FROM op;
$$;

REVOKE ALL ON FUNCTION public.get_my_cheer_quota(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_cheer_quota(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_my_cheer_quota(UUID) IS
  '오늘 응원을 몇 마리 더 보낼 수 있나. 한도 규칙(참여자 3 / 운영자 10)은 서버에만 둔다.';
