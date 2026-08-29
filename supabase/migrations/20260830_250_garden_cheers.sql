-- ============================================================
-- Migration: 250 - 성장 탭 응원 나비(garden_cheers)
-- 작성일: 2026-08-30
-- 설명:
--   참여자끼리 서로에게 보내는 «응원 나비». 249(get_program_garden) 위에 얹는다.
--   아직 참여자에게 노출하지 않는 개발 단계 기능(/dev/growth 전용)이며,
--   새 테이블 + 새 함수 + 인증 트리거 1개 추가라 기존 동작에 영향이 없다.
--
--   ▸ 설계의 핵심 — 보상을 «보낼 때» 가 아니라 «닿았을 때» 준다
--     보낼 때 주면 하루 3점이 무조건 들어와 인증 한 번(+3)과 같아진다.
--     아침에 버튼 세 번 누르고 끝내는 행동이 생기고, 성장이 다시 «활동» 과 무관해진다.
--     닿았을 때 주면 «효과 있는 응원» 만 보상되고 공짜 점수 농사가 불가능하다.
--
--   ▸ 상한
--     · 보내기: 하루 3마리, 같은 사람에겐 하루 1마리(안 그러면 «한 사람이 세 번 눌렀다» 가 된다)
--     · 받기:   기록은 무제한. 다만 «점수» 는 한 번 닿을 때 최대 3점까지만
--     · 보낸 사람: 닿으면 +1, 보낼 당시 상대가 휴면이었으면 +2
--
--   ▸ 왜 점수를 행에 박아두나 (to_points / from_points)
--     249 의 growth_points 는 «인증한 날 수» 로만 계산한다. 응원 점수를 매번 다시 계산하려면
--     닿은 시점의 상한·휴면 여부를 되짚어야 하는데, 그건 지금 상태로는 복원할 수 없다.
--     닿는 순간 확정해서 행에 적어두면 조회는 단순 합계가 되고 감사도 된다.
--
--   ▸ 휴면 판정은 «보낼 때» 한다
--     닿는 건 나중이라 그때 재면 이미 인증한 뒤여서 아무도 휴면이 아니다.
--     기준은 «최근 3일간 그 프로그램에서 승인된 인증 없음» — 설명 가능한 단순 규칙으로 둔다.
--
--   ▸ 프라이버시
--     «누가 누구에게» 는 당사자(보낸 사람·받은 사람)만 본다(RLS).
--     정원 화면에는 사람마다 «대기 중 마릿수» 만 집계로 내려간다(get_program_garden).
--
-- 하위호환:
--   · garden_cheers 는 신규 테이블. 쓰는 코드가 없으면 아무 일도 안 일어난다.
--   · land_garden_cheers_on_approval 트리거는 대기 중 응원이 있을 때만 UPDATE 한다.
--     응원이 하나도 없는 기존 프로그램에서는 사실상 no-op.
--   · get_program_garden 은 «컬럼 추가» 다. 기존 클라이언트는 늘어난 컬럼을 무시하므로 그대로 동작한다.
--     (RETURNS TABLE 형이 바뀌므로 CREATE OR REPLACE 가 안 된다 — DROP 후 재생성. 같은 트랜잭션이라 원자적.)
--
-- 복구:
--   supabase/rollbacks/250_revert_garden_cheers.sql 수동 실행.
-- ============================================================

-- ─── 1) 테이블 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.garden_cheers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  from_user_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  was_dormant   BOOLEAN NOT NULL DEFAULT false,   -- «보낼 때» 상대가 휴면이었나
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  landed_at     TIMESTAMPTZ,                      -- 받은 사람이 인증해서 «닿은» 시각
  to_points     INT NOT NULL DEFAULT 0,           -- 닿을 때 받은 사람이 얻은 점수(상한 적용 후)
  from_points   INT NOT NULL DEFAULT 0,           -- 닿을 때 보낸 사람이 얻은 점수
  CONSTRAINT garden_cheers_not_self CHECK (from_user_id <> to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_garden_cheers_to
  ON public.garden_cheers (program_id, to_user_id) WHERE landed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_garden_cheers_from
  ON public.garden_cheers (program_id, from_user_id, created_at);

-- 같은 사람에겐 하루 1마리 (KST 날짜 기준)
CREATE UNIQUE INDEX IF NOT EXISTS garden_cheers_daily_pair_uniq
  ON public.garden_cheers (program_id, from_user_id, to_user_id,
                           ((created_at AT TIME ZONE 'Asia/Seoul')::date));

-- ─── 2) RLS — 당사자만 자기 행을 본다. 쓰기는 RPC 로만 ──────────
ALTER TABLE public.garden_cheers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS garden_cheers_select_own ON public.garden_cheers;
CREATE POLICY garden_cheers_select_own ON public.garden_cheers
  FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
-- INSERT/UPDATE/DELETE 정책 없음 → 클라이언트 직접 조작 불가(모두 SECURITY DEFINER 함수 경유)

-- ─── 3) 보내기 ────────────────────────────────────────────────
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
  v_today   INT;
  v_dormant BOOLEAN;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;
  IF v_me = p_to_user_id THEN
    RAISE EXCEPTION '자기 자신에게는 보낼 수 없습니다.';
  END IF;
  -- 둘 다 그 프로그램의 활성 참여자여야 한다(기존 헬퍼 재사용)
  IF NOT public._is_active_participant(p_program_id, v_me) THEN
    RAISE EXCEPTION '참여 중인 프로그램에서만 응원을 보낼 수 있습니다.';
  END IF;
  IF NOT public._is_active_participant(p_program_id, p_to_user_id) THEN
    RAISE EXCEPTION '그 프로그램의 참여자가 아닙니다.';
  END IF;

  SELECT COUNT(*) INTO v_today
  FROM public.garden_cheers
  WHERE program_id = p_program_id
    AND from_user_id = v_me
    AND (created_at AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date;

  IF v_today >= 3 THEN
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
    INSERT INTO public.garden_cheers (program_id, from_user_id, to_user_id, was_dormant)
    VALUES (p_program_id, v_me, p_to_user_id, v_dormant);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION '오늘 이미 응원을 보냈어요.';
  END;

  RETURN 3 - (v_today + 1);
END;
$$;

REVOKE ALL ON FUNCTION public.send_garden_cheer(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_garden_cheer(UUID, UUID) TO authenticated;

-- ─── 4) 닿음 — 인증이 승인되면 그 사람에게 온 응원이 «쓰인다» ──
CREATE OR REPLACE FUNCTION public.land_garden_cheers_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program UUID;
BEGIN
  IF NEW.status IS DISTINCT FROM 'APPROVED' THEN
    RETURN NEW;
  END IF;

  SELECT m.program_id INTO v_program FROM public.missions m WHERE m.id = NEW.mission_id;
  IF v_program IS NULL THEN
    RETURN NEW;
  END IF;

  -- 대기 중 응원을 닿게 하고, 그 자리에서 점수를 확정해 적어둔다.
  --   받는 사람: 먼저 온 3마리까지만 1점씩(상한). 나머지는 마음만 전달된다.
  --   보낸 사람: 몇 번째든 항상 보상 — 6번째 사람의 마음이 헛되면 아무도 안 보낸다.
  WITH pend AS (
    SELECT id, was_dormant,
           ROW_NUMBER() OVER (ORDER BY created_at) AS rn
    FROM public.garden_cheers
    WHERE program_id = v_program
      AND to_user_id = NEW.user_id
      AND landed_at IS NULL
  )
  UPDATE public.garden_cheers c
  SET landed_at   = now(),
      to_points   = CASE WHEN p.rn <= 3 THEN 1 ELSE 0 END,
      from_points = CASE WHEN c.was_dormant THEN 2 ELSE 1 END
  FROM pend p
  WHERE c.id = p.id;

  RETURN NEW;
END;
$$;

-- 020 의 채점 트리거와 같은 자리(INSERT 시 자동승인 + UPDATE 시 status 전환 둘 다)
DROP TRIGGER IF EXISTS land_garden_cheers_after_verification ON public.verifications;
CREATE TRIGGER land_garden_cheers_after_verification
AFTER INSERT OR UPDATE OF status ON public.verifications
FOR EACH ROW
EXECUTE FUNCTION public.land_garden_cheers_on_approval();

-- ─── 5) 내 응원 목록 (단독 뷰용 — 누가 보냈는지) ───────────────
CREATE OR REPLACE FUNCTION public.get_my_garden_cheers(p_program_id UUID)
RETURNS TABLE (
  id          UUID,
  direction   TEXT,        -- 'in' = 내가 받은 것, 'out' = 내가 보낸 것
  other_id    UUID,
  nickname    TEXT,
  avatar_path TEXT,
  was_dormant BOOLEAN,
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
         c.was_dormant, c.created_at, c.landed_at, c.to_points
  FROM public.garden_cheers c
  JOIN public.users u ON u.id = c.from_user_id
  WHERE c.program_id = p_program_id AND c.to_user_id = auth.uid()
  UNION ALL
  SELECT c.id, 'out'::text, c.to_user_id, u.nickname, u.avatar_path,
         c.was_dormant, c.created_at, c.landed_at, c.from_points
  FROM public.garden_cheers c
  JOIN public.users u ON u.id = c.to_user_id
  WHERE c.program_id = p_program_id AND c.from_user_id = auth.uid()
  ORDER BY 7 DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_garden_cheers(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_garden_cheers(UUID) TO authenticated;

-- ─── 6) 249 확장 — 대기 중 마릿수 + 응원 점수 합산 ─────────────
-- RETURNS TABLE 형이 바뀌므로 CREATE OR REPLACE 가 안 된다. 같은 트랜잭션이라 원자적.
DROP FUNCTION IF EXISTS public.get_program_garden(UUID);

CREATE FUNCTION public.get_program_garden(p_program_id UUID)
RETURNS TABLE (
  user_id          UUID,
  nickname         TEXT,
  avatar_path      TEXT,
  verify_days      INT,
  growth_points    INT,     -- 인증 기반 + 응원으로 얻은 점수
  pace_streak      INT,
  last_verified_on DATE,
  pace_gap         INT,
  pending_cheers   INT,     -- 아직 «닿지 않은» 응원 마릿수(정원에 뜨는 나비 수)
  is_me            BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH gd AS (   -- 이 프로그램에서 «인증한 날» (승인된 것만, KST 날짜, 하루 여러 건은 하나로)
    SELECT DISTINCT v.user_id AS uid, (v.submitted_at AT TIME ZONE 'Asia/Seoul')::date AS d
    FROM public.verifications v
    JOIN public.missions m ON m.id = v.mission_id
    WHERE m.program_id = p_program_id
      AND v.status = 'APPROVED'
  ),
  rhythm AS (    -- 집계라 행이 없어도 항상 1행(NULL) 이 나온다 → COALESCE 로 기본 2일
    SELECT GREATEST(1, LEAST(7, COALESCE(
             percentile_disc(0.5) WITHIN GROUP (ORDER BY g), 2)))::int AS gap
    FROM (
      SELECT (d - LAG(d) OVER (PARTITION BY uid ORDER BY d)) AS g
      FROM gd
      WHERE d >= (now() AT TIME ZONE 'Asia/Seoul')::date - 28
    ) t
    WHERE g IS NOT NULL AND g <= 14
  ),
  allow AS (SELECT gap, FLOOR(gap * 1.5 + 1)::int AS lim FROM rhythm),
  days AS (
    SELECT uid, d, (d - LAG(d) OVER (PARTITION BY uid ORDER BY d)) AS gap
    FROM gd
  ),
  runs AS (      -- 끊길 때마다 번호가 +1 → 이어진 구간에 id 가 붙는다
    SELECT dy.uid, dy.d,
           SUM(CASE WHEN dy.gap IS NULL OR dy.gap > a.lim THEN 1 ELSE 0 END)
             OVER (PARTITION BY dy.uid ORDER BY dy.d ROWS UNBOUNDED PRECEDING) AS run_id
    FROM days dy CROSS JOIN allow a
  ),
  scored AS (    -- 구간 안 몇 번째인지 = 그날의 연속 횟수
    SELECT uid, d, run_id,
           ROW_NUMBER() OVER (PARTITION BY uid, run_id ORDER BY d) AS k
    FROM runs
  ),
  pts AS (
    SELECT uid,
           COUNT(*)::int AS vdays,
           MAX(d) AS last_d,
           SUM(ROUND(3 * CASE WHEN k >= 10 THEN 2.0
                              WHEN k >= 6  THEN 1.6
                              WHEN k >= 3  THEN 1.3
                              ELSE 1.0 END))::int AS gpoints
    FROM scored GROUP BY uid
  ),
  cur AS (       -- 현재 연속 = 마지막 구간 길이. 마지막 인증이 허용 간격을 넘겼으면 이미 끊긴 것.
    SELECT s.uid,
           CASE WHEN (now() AT TIME ZONE 'Asia/Seoul')::date - MAX(s.d) > (SELECT lim FROM allow)
                THEN 0 ELSE COUNT(*)::int END AS streak
    FROM scored s
    JOIN (SELECT uid, MAX(run_id) AS last_run FROM scored GROUP BY uid) lr
      ON lr.uid = s.uid AND lr.last_run = s.run_id
    GROUP BY s.uid
  ),
  cheer AS (     -- 받은 쪽·보낸 쪽 점수를 한 사람 기준으로 합치고, 대기 중 마릿수를 센다
    SELECT uid, SUM(pt)::int AS pt, SUM(pend)::int AS pending
    FROM (
      SELECT to_user_id AS uid, to_points AS pt,
             CASE WHEN landed_at IS NULL THEN 1 ELSE 0 END AS pend
      FROM public.garden_cheers WHERE program_id = p_program_id
      UNION ALL
      SELECT from_user_id, from_points, 0
      FROM public.garden_cheers WHERE program_id = p_program_id
    ) z
    GROUP BY uid
  )
  SELECT pp.user_id,
         u.nickname,
         u.avatar_path,
         COALESCE(p.vdays, 0),
         COALESCE(p.gpoints, 0) + COALESCE(ch.pt, 0),
         COALESCE(c.streak, 0),
         p.last_d,
         (SELECT gap FROM allow),
         COALESCE(ch.pending, 0),
         (pp.user_id = auth.uid())
  FROM public.program_participants pp
  JOIN public.users u ON u.id = pp.user_id
  LEFT JOIN pts p ON p.uid = pp.user_id
  LEFT JOIN cur c ON c.uid = pp.user_id
  LEFT JOIN cheer ch ON ch.uid = pp.user_id
  WHERE pp.program_id = p_program_id
    AND pp.status = 'ACTIVE'
    AND public._can_view_program(p_program_id, auth.uid())   -- 인가 게이트(랭킹 RPC 와 동일)
  ORDER BY (pp.user_id = auth.uid()) DESC, u.nickname;
$$;

REVOKE ALL ON FUNCTION public.get_program_garden(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_program_garden(UUID) TO authenticated;

COMMENT ON TABLE public.garden_cheers IS
  '성장 탭 응원 나비. 보상은 «닿았을 때»(받는 사람이 인증했을 때) 확정해 행에 적는다.';
COMMENT ON FUNCTION public.get_program_garden(UUID) IS
  '성장 탭(3D 정원) 실데이터. 참여자별 인증일수·성장포인트·연속·대기 중 응원 수와 프로그램 리듬 G.';
