-- ============================================================
-- Migration: 282 - 운영자 한 줄 소개 + 기록 보강 (라벨 재료)
-- 작성일: 2026-10-05
-- 설명:
--   281 을 화면에 붙여 보니 «칭호가 없어서 밋밋하다»(본인). 다만 밋밋함의 절반은
--   «프로필이 아니라 성적표»여서였다 — 얼굴도 소개도 없이 회색 숫자 4줄.
--   본인 결정(2026-10-05): ① 운영자가 직접 쓰는 **한 줄 소개** ② **가로형 라벨**(등급 아님).
--
--   ⭐ 라벨은 «위아래»가 아니라 «어떤 운영자인가»다. 새내기/베테랑/마스터 같은 세로 등급은
--      여전히 안 만든다 — 실측 운영자 12명 중 종료 기수가 있는 사람이 5명뿐이라 등급을 매기면
--      거의 전원이 바닥에 모인다. 가로형은 모수가 적어도 성립하고 누구도 «밑»이 되지 않는다.
--   ⭐ 라벨 «판정»은 이 함수가 하지 않는다. 재료(숫자)만 주고 조건은 화면(JS)이 정한다 —
--      문턱은 운영자가 늘면 계속 바뀔 값이라 마이그레이션으로 묶으면 못 고친다.
--
--   1) users.operator_bio TEXT — 운영자 한 줄 소개(최대 80자). 본인만 쓰고 모두가 읽는다.
--      ⚠️ users 는 «컬럼 단위» SELECT 권한이다. GRANT 를 빠뜨리면 이 컬럼을 고르는 쿼리가
--         통째로 42501 로 죽는다 [[feedback_users_column_grant_2026-09-17]].
--
--   2) get_operator_record 재작성 — 281 과 달라진 점 두 가지
--      · ⚠️ **기수·참여자는 «진행 중»도 센다.** 281 은 셋 다 종료된 기수만 셌는데, 그러면
--        탄탄 챌린지(365일)·피지컬 16 처럼 돌고 있는 프로그램의 운영자가 전부 0 이라
--        「첫 기수를 운영하고 있어요」만 떴다(실측 12명 중 7명). 「2기 운영 중」·「13명과
--        함께하는 중」은 거짓이 아니라 사실이다. **완주만 종료가 필요하다** — 끝나야 판정된다.
--      · comment_90d 추가 — 운영자가 «자기 프로그램에» 쓴 댓글 수(인증 피드 + 커뮤니티).
--        실측상 분포가 가장 좋은 신호다(21·10·4·3·3). 「자주 소통하는」 라벨의 재료.
--
--      정직성 하한은 그대로: 참여자가 0명인 기수는 세지 않는다(참여자 0명 기수 5개인
--      테스트 운영자가 실제로 있다 — 그대로 세면 「운영 5기」라는 거짓 신호).
--      완주 문턱도 그대로: 종료 리포트와 같은 GREATEST(1, CEIL(기간*0.5)).
--
--   하위호환: 컬럼 추가 + 함수 교체(반환 컬럼은 «뒤에» 추가). PostgREST 는 이름으로 돌려주므로
--     배포 전 구버전 화면은 comment_90d 를 무시한다 → 마이그레이션을 먼저 올려도 안전.
--     ⚠️ RETURNS TABLE 은 컬럼을 늘릴 때 CREATE OR REPLACE 가 안 된다 → DROP 후 재생성.
--     관리자 전용이 아니라 참여자도 쓰는 함수지만, 아직 화면이 배포되지 않아 호출자가 없다.
--   [[feedback_deploy_safety]]
--
-- 복구: supabase/rollbacks/282_revert_operator_bio_labels.sql
-- ============================================================

-- ─── 1) 운영자 한 줄 소개 ───────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS operator_bio TEXT;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_operator_bio_len;
ALTER TABLE public.users
  ADD CONSTRAINT users_operator_bio_len CHECK (operator_bio IS NULL OR length(operator_bio) <= 80);

-- 264 와 같은 패턴 — users 에 컬럼을 추가할 때는 이 GRANT 를 «반드시» 같이 넣는다.
GRANT SELECT (operator_bio) ON public.users TO authenticated;
GRANT UPDATE (operator_bio) ON public.users TO authenticated;


-- ─── 2) 운영자 기록 ─────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_operator_record(UUID);

CREATE OR REPLACE FUNCTION public.get_operator_record(p_owner_id UUID)
RETURNS TABLE (
  program_count     INT,
  participant_sum   INT,
  completed_sum     INT,
  reply_median_min  INT,
  comment_90d       INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH today AS (
    SELECT (now() AT TIME ZONE 'Asia/Seoul')::date AS d
  ),
  -- 기간이 잡혀 있고 참여자가 실제로 있었던 기수 — 진행 중도 포함한다
  prog AS (
    SELECT p.id,
           (p.end_date < (SELECT d FROM today)) AS ended,
           GREATEST(1, (p.end_date - p.start_date) + 1) AS days,
           (SELECT count(*) FROM public.program_participants pp
             WHERE pp.program_id = p.id AND pp.status IN ('ACTIVE', 'COMPLETED'))::int AS n_part
    FROM public.programs p
    WHERE p.owner_id = p_owner_id
      AND p.start_date IS NOT NULL
      AND p.end_date IS NOT NULL
  ),
  prog_ok AS (
    SELECT id, ended, n_part,
           GREATEST(1, CEIL(days * 0.5))::int AS threshold   -- 리포트와 같은 문턱
    FROM prog WHERE n_part > 0
  ),
  -- 완주는 «끝난» 기수에서만. 활동일 = APPROVED 인증의 고유 KST 날짜 수(리포트와 같은 정의)
  active AS (
    SELECT po.id AS program_id, v.user_id,
           count(DISTINCT (v.submitted_at AT TIME ZONE 'Asia/Seoul')::date)::int AS active_days
    FROM prog_ok po
    JOIN public.missions m ON m.program_id = po.id
    JOIN public.verifications v ON v.mission_id = m.id AND v.status = 'APPROVED'
    JOIN public.program_participants pp
      ON pp.program_id = po.id AND pp.user_id = v.user_id AND pp.status IN ('ACTIVE', 'COMPLETED')
    WHERE po.ended
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
  ),
  -- 소통량 — 운영자가 «자기 프로그램에» 쓴 댓글(인증 피드 + 커뮤니티), 최근 90일
  cmt AS (
    SELECT (
      (SELECT count(*) FROM public.post_comments pc
         JOIN public.verifications v ON v.id = pc.verification_id
         JOIN public.missions m ON m.id = v.mission_id
         JOIN public.programs p ON p.id = m.program_id
        WHERE pc.user_id = p_owner_id AND p.owner_id = p_owner_id
          AND pc.created_at >= now() - interval '90 days')
      +
      (SELECT count(*) FROM public.community_post_comments cc
         JOIN public.community_posts cp ON cp.id = cc.post_id
         JOIN public.programs p ON p.id = cp.program_id
        WHERE cc.user_id = p_owner_id AND p.owner_id = p_owner_id
          AND cc.created_at >= now() - interval '90 days')
    )::int AS n
  )
  SELECT
    (SELECT count(*) FROM prog_ok)::int,
    (SELECT coalesce(sum(n_part), 0) FROM prog_ok)::int,
    (SELECT count(*) FROM active a
       JOIN prog_ok po ON po.id = a.program_id
      WHERE a.active_days >= po.threshold)::int,
    (SELECT CASE WHEN n >= 5 THEN round(med)::int ELSE NULL END FROM reply),
    (SELECT n FROM cmt)
  WHERE auth.uid() IS NOT NULL;   -- 익명에는 아무것도 주지 않는다
$fn$;

-- 익명 차단은 PUBLIC 만으론 안 된다 → anon 명시 [[feedback_revoke_from_public_footgun]]
REVOKE ALL ON FUNCTION public.get_operator_record(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_operator_record(UUID) TO authenticated;

-- 소통량 집계가 작성자로 좁히는 경로를 받쳐 준다.
CREATE INDEX IF NOT EXISTS idx_post_comments_user_created
  ON public.post_comments (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_community_post_comments_user_created
  ON public.community_post_comments (user_id, created_at);
