-- ============================================================
-- Migration: 280 - 닉네임 옆 불꽃(주간 리듬) — 설정 컬럼 + 계산 RPC
-- 작성일: 2026-10-04
-- 설명:
--   레벨링 1단계. 꾸준히 참여하는 사람의 닉네임 옆에 불꽃을 붙인다.
--   본인 결정(2026-10-04): 일 연속이 아니라 «주 단위 리듬», 기본 주 3일·운영자 변경 가능,
--   기본 켬(기존 프로그램 포함), 활동 = 인증 + 퀴즈 + 클래스 참석(댓글 제외).
--
--   1) programs.flame_enabled   BOOLEAN DEFAULT true  — 프로그램 설정에서 끔/켬
--      programs.flame_week_days INT     DEFAULT 3     — 주 몇 일 활동하면 그 주를 채운 것으로 보나(1~7)
--
--   2) get_program_flames(p_program_id) — 불꽃이 «켜진» 참여자만 돌려준다(읽기 전용).
--      · 활동일(KST): 반려 아닌 인증의 제출일 · 퀴즈 제출일 · 확정 출석한 수업의 «수업 날짜»
--        (출석부를 다음 날 몰아 체크해도 수업한 날로 센다). 하루 여러 건 = 1일.
--      · 기회일: 미션이 열린 날(active_from~until·요일·제외기간) · 퀴즈가 열린 날(start_at,
--        없으면 created_at — 퀴즈는 1회성이라 «여는 날» 하루만) · 수업이 있는 날.
--        프로그램 기간(start_date~end_date) 안으로 자른다.
--      · 그 주 기준 = least(flame_week_days, 그 주 기회일 수). 기회일 0인 주는 «쉬는 주» —
--        판정에서 빼고 건너뛴다(끊김도 충족도 아님). 특정일에만 미션을 여는 운영 방식 대응.
--        이번 주 기준은 이미 공지된 남은 날(예정 미션·수업)까지 포함한 주 전체로 잡는다.
--      · 켜짐 = 이번 주를 이미 채웠거나, 직전(쉬는 주 제외) 주를 채웠을 때.
--        → 월요일에 모두의 불꽃이 한꺼번에 꺼지지 않는다.
--      · streak_weeks = 기준 주(이번 주 또는 직전 주)부터 거꾸로 이어진 «채운 주» 수.
--        flame_level 1(1주~) / 2(3주~) / 3(6주~). 꺼진 사람은 행 자체가 없다(퍼소나 4-6:
--        끊긴 것을 들추지 않는다 — 0·회색 표시 금지).
--      · 열람 권한: 운영자·활성 참여자·관리자·공개(PUBLISHED+is_public) 프로그램 열람자.
--        그 밖이면 빈 결과. 피드에 이미 공개되는 «활동 여부»의 요약이라 민감도는 같다.
--      · 최근 52주까지만 본다.
--
--   하위호환: 컬럼 추가(DEFAULT 有) + 새 함수뿐. 기존 함수·정책·데이터 변경 없음.
--   화면 코드가 배포되기 전엔 아무도 이 값을 읽지 않는다 → 마이그 먼저 올려도 안전.
--   [[feedback_deploy_safety]]
--
-- 복구: supabase/rollbacks/280_revert_program_flames.sql
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS flame_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS flame_week_days INT NOT NULL DEFAULT 3;

ALTER TABLE public.programs
  DROP CONSTRAINT IF EXISTS programs_flame_week_days_check;
ALTER TABLE public.programs
  ADD CONSTRAINT programs_flame_week_days_check CHECK (flame_week_days BETWEEN 1 AND 7);


CREATE OR REPLACE FUNCTION public.get_program_flames(p_program_id UUID)
RETURNS TABLE (user_id UUID, flame_level INT, streak_weeks INT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
#variable_conflict use_column
DECLARE
  v_prog  public.programs%ROWTYPE;
  v_today DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_wcur  DATE;
  v_w0    DATE;
  v_dmin  DATE;
  v_dmax  DATE;
BEGIN
  SELECT * INTO v_prog FROM public.programs p WHERE p.id = p_program_id;
  IF NOT FOUND OR NOT v_prog.flame_enabled THEN
    RETURN;
  END IF;

  -- 열람 권한 — 밖이면 조용히 빈 결과
  IF NOT (
       v_prog.owner_id = auth.uid()
    OR public._is_active_participant(p_program_id, auth.uid())
    OR public.is_admin()
    OR (v_prog.status = 'PUBLISHED' AND v_prog.is_public = true)
  ) THEN
    RETURN;
  END IF;

  v_wcur := date_trunc('week', v_today)::date;                       -- 이번 주 월요일
  v_dmin := greatest(coalesce(v_prog.start_date, v_today - 364), v_today - 364);
  v_w0   := date_trunc('week', v_dmin)::date;
  v_dmax := least(coalesce(v_prog.end_date, v_wcur + 6), v_wcur + 6);  -- 이번 주 일요일까지

  IF v_dmin > v_dmax THEN
    RETURN;   -- 아직 시작 전
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(v_dmin, v_dmax, interval '1 day')::date AS d
  ),
  opp AS (   -- 기회일
    SELECT dd.d
    FROM days dd
    WHERE EXISTS (
            SELECT 1 FROM public.missions m
            WHERE m.program_id = p_program_id
              AND dd.d >= coalesce((m.active_from  AT TIME ZONE 'Asia/Seoul')::date, v_dmin)
              AND dd.d <= coalesce((m.active_until AT TIME ZONE 'Asia/Seoul')::date, v_dmax)
              AND CASE m.schedule_mode
                    WHEN 'WEEKDAYS' THEN extract(isodow FROM dd.d) <= 5
                    WHEN 'WEEKENDS' THEN extract(isodow FROM dd.d) >= 6
                    WHEN 'CUSTOM'   THEN extract(isodow FROM dd.d)::int = ANY (m.active_days)
                    ELSE true
                  END
              AND NOT EXISTS (
                    SELECT 1 FROM jsonb_array_elements(coalesce(m.excluded_periods, '[]'::jsonb)) e
                    WHERE e->>'start_date' IS NOT NULL
                      AND dd.d BETWEEN (e->>'start_date')::date
                                   AND coalesce(nullif(e->>'end_date', '')::date, (e->>'start_date')::date)
                  )
          )
       OR EXISTS (
            SELECT 1 FROM public.quizzes q
            WHERE q.program_id = p_program_id
              AND (coalesce(q.start_at, q.created_at) AT TIME ZONE 'Asia/Seoul')::date = dd.d
          )
       OR EXISTS (
            SELECT 1 FROM public.sessions s
            WHERE s.program_id = p_program_id
              AND (s.starts_at AT TIME ZONE 'Asia/Seoul')::date = dd.d
          )
  ),
  weeks AS (
    SELECT generate_series(v_w0, v_wcur, interval '7 days')::date AS w
  ),
  wk_need AS (   -- 그 주 기준 일수 (0 = 쉬는 주)
    SELECT wk.w, least(v_prog.flame_week_days, count(o.d))::int AS need
    FROM weeks wk
    LEFT JOIN opp o ON o.d >= wk.w AND o.d < wk.w + 7
    GROUP BY wk.w
  ),
  parts AS (
    SELECT pp.user_id
    FROM public.program_participants pp
    WHERE pp.program_id = p_program_id
      AND pp.status IN ('ACTIVE', 'COMPLETED')
  ),
  act AS (   -- 활동일 (사람·날짜 중복 제거)
    SELECT DISTINCT x.user_id, x.d
    FROM (
      SELECT v.user_id, (v.submitted_at AT TIME ZONE 'Asia/Seoul')::date AS d
      FROM public.verifications v
      JOIN public.missions m ON m.id = v.mission_id
      WHERE m.program_id = p_program_id
        AND v.status <> 'REJECTED'
      UNION ALL
      SELECT qs.user_id, (qs.submitted_at AT TIME ZONE 'Asia/Seoul')::date
      FROM public.quiz_submissions qs
      JOIN public.quizzes q ON q.id = qs.quiz_id
      WHERE q.program_id = p_program_id
      UNION ALL
      SELECT sa.user_id, (s.starts_at AT TIME ZONE 'Asia/Seoul')::date
      FROM public.session_attendance sa
      JOIN public.sessions s ON s.id = sa.session_id
      WHERE s.program_id = p_program_id
        AND sa.status = 'confirmed'
    ) x
    WHERE x.d BETWEEN v_w0 AND v_wcur + 6
  ),
  wk_act AS (
    SELECT a.user_id, date_trunc('week', a.d)::date AS w, count(*)::int AS n
    FROM act a
    GROUP BY 1, 2
  ),
  grid AS (   -- 쉬는 주를 뺀 «사람 × 주» 충족표
    SELECT pa.user_id, wn.w, (coalesce(wa.n, 0) >= wn.need) AS met
    FROM parts pa
    CROSS JOIN wk_need wn
    LEFT JOIN wk_act wa ON wa.user_id = pa.user_id AND wa.w = wn.w
    WHERE wn.need > 0
  ),
  prevw AS (    -- 직전 주 = 이번 주 이전의 마지막 «쉬는 주 아닌» 주
    SELECT g.user_id, max(g.w) FILTER (WHERE g.w < v_wcur) AS pw
    FROM grid g
    GROUP BY g.user_id
  ),
  anchor AS (   -- 기준 주: 이번 주를 채웠으면 이번 주, 아니면 직전 주(채웠을 때만)
    SELECT pv.user_id,
      CASE
        WHEN EXISTS (SELECT 1 FROM grid g WHERE g.user_id = pv.user_id AND g.w = v_wcur AND g.met)
          THEN v_wcur
        WHEN EXISTS (SELECT 1 FROM grid g WHERE g.user_id = pv.user_id AND g.w = pv.pw AND g.met)
          THEN pv.pw
      END AS aw
    FROM prevw pv
  ),
  runs AS (
    SELECT an.user_id,
      (SELECT count(*) FROM grid g
        WHERE g.user_id = an.user_id
          AND g.w <= an.aw
          AND g.w > coalesce(
                (SELECT max(g3.w) FROM grid g3
                  WHERE g3.user_id = an.user_id AND g3.w <= an.aw AND NOT g3.met),
                '-infinity'::date)
      )::int AS sw
    FROM anchor an
    WHERE an.aw IS NOT NULL
  )
  SELECT r.user_id,
    CASE WHEN r.sw >= 6 THEN 3 WHEN r.sw >= 3 THEN 2 ELSE 1 END,
    r.sw
  FROM runs r
  WHERE r.sw >= 1;
END;
$fn$;

-- 익명 차단은 PUBLIC 만으론 안 된다 → anon 명시 [[feedback_revoke_from_public_footgun]]
REVOKE ALL ON FUNCTION public.get_program_flames(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_program_flames(UUID) TO authenticated;
