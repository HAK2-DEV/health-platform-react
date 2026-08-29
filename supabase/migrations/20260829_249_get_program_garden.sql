-- ============================================================
-- Migration: 249 - 성장 탭(3D 정원) 실데이터 RPC
-- 작성일: 2026-08-29
-- 설명:
--   /dev/growth 의 3D 정원이 쓸 참여자별 성장 데이터를 한 번에 내려준다.
--   아직 참여자에게 노출하지 않는 개발 단계 기능이며, 읽기 전용이라 기존 동작에 영향이 없다.
--
--   ▸ 왜 RPC 인가
--     program_participants 의 RLS 는 본인 row 만 보이게 돼 있다(077 주석 참조).
--     정원은 «참여자 전원의 꽃» 을 그려야 하므로 집계 함수로만 열어준다.
--     노출 범위는 이미 있는 get_program_ranking 과 동일하다(닉네임·아바타·활동량).
--
--   ▸ 왜 score_ledgers 를 안 쓰나
--     운영자가 미션 점수를 자유롭게 정한다(1점짜리도, 100점짜리도 있다).
--     그 값을 성장에 쓰면 단계 임계값이 프로그램마다 딴판이 된다.
--     그래서 «인증한 날 수» 라는 프로그램 독립적인 양으로 센다.
--
--   ▸ 프로그램 리듬 G
--     운영자가 매일형/주 몇 회형을 따로 설정하지 않으므로 데이터에서 추론한다.
--     최근 28일, 참여자들의 «인증한 날 사이 간격» 중앙값(1~7일로 제한).
--     롤링 창이라 미션이 중간에 추가/삭제돼도 1~2주 안에 새 리듬으로 옮겨간다.
--     14일 초과 간격은 리듬이 아니라 이탈이므로 제외.
--
--   ▸ 연속과 배수
--     허용 간격 = floor(G*1.5+1). 딱 맞추라고 하면 너무 빡빡하다.
--     그 안으로 이어진 횟수가 연속이고, 배수는 3/6/10회에서 1.3/1.6/2.0 (상한 2배).
--     «많이» 가 아니라 «꾸준히» 를 보상한다.
--
-- 복구:
--   supabase/rollbacks/249_revert_get_program_garden.sql 수동 실행.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_verifications_user_submitted
  ON public.verifications (user_id, submitted_at);

CREATE OR REPLACE FUNCTION public.get_program_garden(p_program_id UUID)
RETURNS TABLE (
  user_id          UUID,
  nickname         TEXT,
  avatar_path      TEXT,
  verify_days      INT,     -- 인증한 «날» 수
  growth_points    INT,     -- 연속 배수까지 반영한 누적 성장 포인트
  pace_streak      INT,     -- 프로그램 리듬 기준 현재 연속
  last_verified_on DATE,
  pace_gap         INT,     -- 프로그램 리듬 G (모든 행 동일 — 한 번에 받으려고 실어 보냄)
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
  )
  SELECT pp.user_id,
         u.nickname,
         u.avatar_path,
         COALESCE(p.vdays, 0),
         COALESCE(p.gpoints, 0),
         COALESCE(c.streak, 0),
         p.last_d,
         (SELECT gap FROM allow),
         (pp.user_id = auth.uid())
  FROM public.program_participants pp
  JOIN public.users u ON u.id = pp.user_id
  LEFT JOIN pts p ON p.uid = pp.user_id
  LEFT JOIN cur c ON c.uid = pp.user_id
  WHERE pp.program_id = p_program_id
    AND pp.status = 'ACTIVE'
    AND public._can_view_program(p_program_id, auth.uid())   -- 인가 게이트(랭킹 RPC 와 동일)
  ORDER BY (pp.user_id = auth.uid()) DESC, u.nickname;
$$;

REVOKE ALL ON FUNCTION public.get_program_garden(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_program_garden(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_program_garden(UUID) IS
  '성장 탭(3D 정원) 실데이터. 참여자별 인증일수·성장포인트·연속과 프로그램 리듬 G를 함께 반환.';
