-- ============================================================
-- Migration: 279 - 관리자 콘솔 「14일 활동」에 일일 접속자 수(DAU) 추가
-- 작성일: 2026-10-04
-- 설명:
--   콘솔에 «사람 수» 지표가 없었다. 「참여」 타일은 program_participants 의 «누적»이라
--   오늘 아무도 안 들어와도 그대로다. admin_activity 에 하루 단위 접속자 수를 더한다.
--
--   DAU 정의 — screen_events 의 그 날(KST) 고유 user_id 수.
--     · screen_events(146) 는 로그인 사용자의 화면 이동을 기록한다(user_id NOT NULL).
--     · 따라서 «로그인해서 화면을 연 사람» 이다. 비로그인 방문은 포함되지 않는다.
--     · 개인정보처리방침이 고지한 «화면 이용 통계»가 이 테이블이다.
--
--   ⚠️ RETURNS TABLE 이라 CREATE OR REPLACE 로 컬럼을 늘릴 수 없다(반환 타입 변경 불가).
--      DROP 후 재생성한다. 그 사이 admin_activity 호출은 실패하지만 관리자 전용이고
--      같은 스크립트 안에서 즉시 재생성되므로 창이 매우 짧다.
--
--   하위호환: 기존 3개 컬럼은 이름·순서·의미 그대로이고 dau 가 «뒤에» 붙는다.
--   PostgREST 는 컬럼을 이름으로 돌려주므로 배포 전 구버전 화면은 dau 를 무시한다.
--   → 마이그레이션을 먼저 올려도 안전하다. [[feedback_deploy_safety]]
--
--   ⚠️ 알아 둘 것: screen_events 에는 보관 기간 정리(cron)가 없다. 계속 쌓인다.
--      DB 용량 경보(255)와 맞물릴 수 있어 별도 과제로 남긴다.
--
-- 복구: supabase/rollbacks/279_revert_admin_activity_dau.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_activity(INT);

CREATE OR REPLACE FUNCTION public.admin_activity(p_days INT DEFAULT 14)
RETURNS TABLE (day DATE, verify_count BIGINT, post_count BIGINT, join_count BIGINT, dau BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH span AS (
    SELECT generate_series(
      (now() AT TIME ZONE 'Asia/Seoul')::date - (greatest(coalesce(p_days, 14), 1) - 1),
      (now() AT TIME ZONE 'Asia/Seoul')::date,
      interval '1 day')::date AS dd
  )
  SELECT s.dd,
    (SELECT count(*) FROM public.verifications v
      WHERE (v.submitted_at AT TIME ZONE 'Asia/Seoul')::date = s.dd)::BIGINT,
    (SELECT count(*) FROM public.community_posts c
      WHERE (c.created_at AT TIME ZONE 'Asia/Seoul')::date = s.dd)::BIGINT,
    (SELECT count(*) FROM public.program_participants pp
      WHERE (pp.joined_at AT TIME ZONE 'Asia/Seoul')::date = s.dd)::BIGINT,
    -- 일일 접속자 — 그 날 화면을 연 «사람» 수(중복 제거)
    (SELECT count(DISTINCT e.user_id) FROM public.screen_events e
      WHERE (e.created_at AT TIME ZONE 'Asia/Seoul')::date = s.dd)::BIGINT
  FROM span s
  WHERE public.is_admin()
  ORDER BY s.dd;
$fn$;

-- 256 과 같은 권한 — 관리자 가드는 함수 안의 is_admin() 이 한다.
REVOKE ALL ON FUNCTION public.admin_activity(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_activity(INT) TO authenticated;

-- 날짜 범위 조회가 매일 돌므로 인덱스를 둔다(없으면 전체 스캔).
CREATE INDEX IF NOT EXISTS idx_screen_events_created_at
  ON public.screen_events (created_at);
