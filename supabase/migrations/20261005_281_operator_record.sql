-- ============================================================
-- Migration: 281 - 운영자 기록 (칭호 아님, «사실만 표시»)
-- 작성일: 2026-10-05
-- 설명:
--   레벨링 2단계. 운영자에게 «새내기/베테랑/마스터» 같은 등급을 매기지 않고
--   숫자를 그대로 보여준다.
--   본인 결정(2026-10-05): 등급 폐기. Why — 퍼소나 원칙 4(숫자를 부풀리지 않는다) + 실측상
--   눈금을 매길 모수가 없다(운영자 12명·프로그램 22개 중 «종료+14일+5명» 기수는 2개뿐이라
--   어떤 눈금을 잡아도 전원 1단계였다).
--
--   get_operator_record(p_owner_id) — 운영자 한 명의 기록을 한 번에(읽기 전용).
--     · program_count   운영한 기수   — «참여자가 실제 있었고 종료된» 공개 가능 기수 수
--     · participant_sum 함께한 참여자 — 위 기수들의 참여자 연인원(같은 사람 반복 포함)
--     · completed_sum   완주한 참여자 — 위 기수들의 완주자 연인원
--     · reply_median_min 보통 응답 시간(분) — 최근 30일, 운영자 심사 인증의 중앙값. 표본<5 면 NULL
--
--   ⚠️ 정의를 새로 만들지 않는다 — 완주는 종료 리포트의 «결정 B 고정 기준» 그대로다.
--      활동일 = APPROVED 인증의 고유 KST 날짜 수 (ProgramEndReportPage: fetchProgramStats 가
--      status='APPROVED' 만 집계). 기간 = end_date - start_date + 1 일.
--      완주 문턱 = GREATEST(1, CEIL(기간 * 0.5)).  ← 두 곳이 갈리면 리포트와 기록이 어긋난다.
--      ⚠️ 불꽃(280)의 «활동일»과는 일부러 다르다 — 그쪽은 PENDING_REVIEW·퀴즈·출석도 세지만
--      여기는 리포트가 말하는 완주와 한 글자도 어긋나면 안 된다.
--
--   정직성 하한(선택지 아님): 참여자가 0명인 기수는 세지 않는다.
--     실측에 «참여자 0명 기수 5개»인 운영자가 있다(전부 테스트). 그대로 세면 「운영 5기」라는
--     거짓 신호가 된다. 종료 전(진행 중) 기수도 완주가 확정되지 않아 제외한다.
--
--   비율(완주율)은 돌려주지 않는다 — 운영자끼리 비교·압박을 만든다(퍼소나 금지선).
--
--   응답 시간: verification_type='MANUAL' 인증의 submitted_at→reviewed_at 중앙값.
--     AUTO 는 즉시 승인이라 의미가 없고, 평균은 휴가 한 번으로 망가지므로 중앙값.
--     표본 5건 미만이면 NULL(2건으로 「보통 1시간」은 거짓말이다).
--     ⚠️ 화면 정책은 여기서 강제하지 않는다 — 참여자에겐 하루 안쪽일 때만, 운영자 본인에겐
--        그대로 보여준다(본인 결정). 함수는 사실을 주고 판단은 화면이 한다.
--
--   열람: 로그인 사용자 누구나(운영자 기록은 참여자에게 공개하기로 한 신뢰 신호).
--     공개 대상 자체가 «공개 프로그램을 여는 운영자»이고, 돌려주는 값은 집계뿐이라
--     개별 참여자를 식별할 수 없다.
--
--   하위호환: 새 함수뿐. 기존 테이블·정책·함수 변경 없음. 화면이 배포되기 전엔 아무도 안 읽는다.
--   [[feedback_deploy_safety]]
--
-- 복구: supabase/rollbacks/281_revert_operator_record.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_operator_record(p_owner_id UUID)
RETURNS TABLE (
  program_count     INT,
  participant_sum   INT,
  completed_sum     INT,
  reply_median_min  INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH today AS (
    SELECT (now() AT TIME ZONE 'Asia/Seoul')::date AS d
  ),
  -- 집계 대상 기수 — 종료됐고, 기간이 잡혀 있고, 참여자가 실제로 있었던 것만
  prog AS (
    SELECT p.id,
           GREATEST(1, (p.end_date - p.start_date) + 1) AS days,
           (SELECT count(*) FROM public.program_participants pp
             WHERE pp.program_id = p.id AND pp.status IN ('ACTIVE', 'COMPLETED'))::int AS n_part
    FROM public.programs p, today t
    WHERE p.owner_id = p_owner_id
      AND p.start_date IS NOT NULL
      AND p.end_date IS NOT NULL
      AND p.end_date < t.d
  ),
  prog_ok AS (
    SELECT id, days, n_part,
           GREATEST(1, CEIL(days * 0.5))::int AS threshold   -- 리포트와 같은 문턱
    FROM prog WHERE n_part > 0
  ),
  -- 사람·기수별 활동일 = APPROVED 인증의 고유 KST 날짜 수 (리포트와 같은 정의)
  active AS (
    SELECT po.id AS program_id, v.user_id,
           count(DISTINCT (v.submitted_at AT TIME ZONE 'Asia/Seoul')::date)::int AS active_days
    FROM prog_ok po
    JOIN public.missions m ON m.program_id = po.id
    JOIN public.verifications v ON v.mission_id = m.id AND v.status = 'APPROVED'
    JOIN public.program_participants pp
      ON pp.program_id = po.id AND pp.user_id = v.user_id AND pp.status IN ('ACTIVE', 'COMPLETED')
    GROUP BY po.id, v.user_id
  ),
  -- 응답 시간 — 최근 30일, 운영자가 직접 심사하는(MANUAL) 인증만
  reply AS (
    SELECT percentile_cont(0.5) WITHIN GROUP (
             ORDER BY EXTRACT(EPOCH FROM (v.reviewed_at - v.submitted_at)) / 60
           ) AS med,
           count(*) AS n
    FROM public.programs p
    JOIN public.missions m ON m.program_id = p.id AND m.verification_type = 'MANUAL'
    JOIN public.verifications v ON v.mission_id = m.id
    WHERE p.owner_id = p_owner_id
      AND v.reviewed_at IS NOT NULL
      AND v.reviewed_at >= now() - interval '30 days'
      AND v.reviewed_at >= v.submitted_at           -- 시계 역전 방어
  )
  SELECT
    (SELECT count(*) FROM prog_ok)::int,
    (SELECT coalesce(sum(n_part), 0) FROM prog_ok)::int,
    (SELECT count(*) FROM active a
       JOIN prog_ok po ON po.id = a.program_id
      WHERE a.active_days >= po.threshold)::int,
    (SELECT CASE WHEN n >= 5 THEN round(med)::int ELSE NULL END FROM reply)
  WHERE auth.uid() IS NOT NULL;   -- 익명에는 아무것도 주지 않는다
$fn$;

-- 익명 차단은 PUBLIC 만으론 안 된다 → anon 명시 [[feedback_revoke_from_public_footgun]]
REVOKE ALL ON FUNCTION public.get_operator_record(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_operator_record(UUID) TO authenticated;

-- 운영자 기록은 프로그램 상세를 열 때마다 돈다. 종료된 기수를 owner 로 찾는 경로를 받쳐 준다.
CREATE INDEX IF NOT EXISTS idx_programs_owner_end_date
  ON public.programs (owner_id, end_date);
