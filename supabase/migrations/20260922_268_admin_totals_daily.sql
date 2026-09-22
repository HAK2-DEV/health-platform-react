-- ============================================================
-- Migration: 268 - 관리자 콘솔 「서비스 현황」 전일 대비 증감
-- 작성일: 2026-09-22
-- 설명:
--   /admin 「서비스 현황」 8개 타일이 지금은 누적 수치만 보여줘서
--   전날보다 얼마나 늘었는지(줄었는지) 알 수 없다.
--   → 매일 자정(KST) 집계를 한 행으로 저장하고, admin_totals() 가
--     현재값 + 전일값을 함께 돌려준다.
--
--   1) public.admin_totals_daily — 날짜별 스냅샷 (snapshot_date PK, totals JSONB)
--   2) snapshot_admin_totals()  — 오늘 자 스냅샷 upsert (cron 이 호출)
--   3) pg_cron 'snapshot-admin-totals' 매일 KST 00:05 (= UTC 15:05)
--      071 rank_snapshots 와 같은 방식·같은 시각대.
--   4) admin_totals() 확장 — 기존 8개 키를 «그대로 두고»
--      'prev'(전일 집계) · 'prev_date' · 'prev_source' 를 «추가»한다.
--
--   ⚠️ 전일 스냅샷이 아직 없으면(오늘 적용분) 원시 테이블의 created_at 으로
--      재계산해 폴백한다. 재계산은 «남아 있는 행» 기준이라 그 사이 삭제·상태변경으로
--      «줄어든 것»은 못 잡는다 → prev_source 로 구분해 UI 가 표기할 수 있게 한다.
--        'snapshot'    = 정확 (증가·감소 모두)
--        'recomputed'  = 근사 (증가만)
--      스냅샷이 하루라도 쌓이면 자동으로 'snapshot' 경로를 쓴다.
--
--   ⚠️ 관리자 전용 데이터 — 테이블은 RLS 를 켜고 «정책을 만들지 않는다».
--      authenticated 는 직접 SELECT 불가, 조회는 SECURITY DEFINER RPC 로만.
--
-- 영향:
--   신규 테이블 1개 + 신규 함수 1개 + cron 1개 + admin_totals() 반환 키 추가.
--   기존 키(users·programs·published·participants·verifications·posts·push_subs·sessions)는
--   이름·의미 그대로 → 배포 전 구버전 화면도 그대로 동작한다. [[feedback_deploy_safety]]
--
-- 복구: supabase/rollbacks/268_revert_admin_totals_daily.sql
-- ============================================================

-- ── 1) 날짜별 스냅샷 테이블 ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_totals_daily (
  snapshot_date DATE PRIMARY KEY,                  -- KST 기준 날짜
  totals        JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_totals_daily ENABLE ROW LEVEL SECURITY;
-- 정책 없음 = 일반 사용자 직접 접근 불가(관리자도 RPC 경유). service_role 은 RLS 우회.

COMMENT ON TABLE public.admin_totals_daily IS
  '관리자 콘솔 서비스 현황 일일 스냅샷 — 전일 대비 증감 계산용. cron snapshot-admin-totals 가 채운다.';

-- ── 2) 현재 집계 (내부 헬퍼) ─────────────────────────────
--   admin_totals() 와 스냅샷이 «같은 정의»를 쓰도록 한 곳에 둔다.
CREATE OR REPLACE FUNCTION public.admin_totals_now()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'users',         (SELECT count(*) FROM public.users),
    'programs',      (SELECT count(*) FROM public.programs),
    'published',     (SELECT count(*) FROM public.programs WHERE status = 'PUBLISHED'),
    'participants',  (SELECT count(*) FROM public.program_participants WHERE status = 'ACTIVE'),
    'verifications', (SELECT count(*) FROM public.verifications),
    'posts',         (SELECT count(*) FROM public.community_posts),
    'push_subs',     (SELECT count(*) FROM public.push_subscriptions),
    'sessions',      (SELECT count(*) FROM public.sessions)
  );
$fn$;
REVOKE ALL ON FUNCTION public.admin_totals_now() FROM PUBLIC;

-- ── 3) 오늘 자 스냅샷 기록 (cron 전용) ───────────────────
CREATE OR REPLACE FUNCTION public.snapshot_admin_totals()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  INSERT INTO public.admin_totals_daily (snapshot_date, totals)
  VALUES (v_today, public.admin_totals_now())
  ON CONFLICT (snapshot_date)
  DO UPDATE SET totals = EXCLUDED.totals, created_at = now();
END;
$fn$;
REVOKE ALL ON FUNCTION public.snapshot_admin_totals() FROM PUBLIC;

-- ── 4) 매일 KST 00:05 (UTC 15:05) — 071 과 같은 방식 ─────
DO $do$
BEGIN
  PERFORM cron.unschedule('snapshot-admin-totals') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'snapshot-admin-totals'
  );
EXCEPTION WHEN others THEN NULL;
END $do$;

SELECT cron.schedule('snapshot-admin-totals', '5 15 * * *', $cron$SELECT public.snapshot_admin_totals();$cron$);

-- 적용 직후 오늘 자 기준선 한 행 — 내일 스냅샷과 비교할 때 쓰인다.
SELECT public.snapshot_admin_totals();

-- ── 5) 전일 집계 재계산 폴백 ─────────────────────────────
--   스냅샷이 없는 날짜(=이 마이그레이션 적용 전)용. 기준 시각은 «해당 날짜 24:00 KST».
--   ⚠️ 남아 있는 행만 세므로 삭제·상태변경으로 «줄어든 것»은 반영되지 않는다(증가만).
CREATE OR REPLACE FUNCTION public.admin_totals_as_of(p_date DATE)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH cut AS (
    SELECT ((p_date + 1)::timestamp AT TIME ZONE 'Asia/Seoul') AS ts   -- 그 날 24:00 KST
  )
  SELECT jsonb_build_object(
    'users',         (SELECT count(*) FROM public.users u, cut WHERE u.created_at < cut.ts),
    'programs',      (SELECT count(*) FROM public.programs p, cut WHERE p.created_at < cut.ts),
    -- 상태 전이(ENDED 등) 시각이 없어 근사: 그때 이미 발행돼 있었고 지금도 PUBLISHED 인 것
    'published',     (SELECT count(*) FROM public.programs p, cut
                       WHERE p.status = 'PUBLISHED' AND p.published_at IS NOT NULL AND p.published_at < cut.ts),
    'participants',  (SELECT count(*) FROM public.program_participants pp, cut
                       WHERE pp.status = 'ACTIVE' AND pp.joined_at < cut.ts),
    'verifications', (SELECT count(*) FROM public.verifications v, cut WHERE v.submitted_at < cut.ts),
    'posts',         (SELECT count(*) FROM public.community_posts c, cut WHERE c.created_at < cut.ts),
    'push_subs',     (SELECT count(*) FROM public.push_subscriptions s, cut WHERE s.created_at < cut.ts),
    'sessions',      (SELECT count(*) FROM public.sessions s, cut WHERE s.created_at < cut.ts)
  );
$fn$;
REVOKE ALL ON FUNCTION public.admin_totals_as_of(DATE) FROM PUBLIC;

-- ── 6) admin_totals() — 기존 키 유지 + prev 추가 ─────────
CREATE OR REPLACE FUNCTION public.admin_totals()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_yday DATE := (now() AT TIME ZONE 'Asia/Seoul')::date - 1;
  v_prev JSONB;
  v_src  TEXT;
BEGIN
  IF NOT public.is_admin() THEN RETURN NULL; END IF;

  SELECT totals INTO v_prev FROM public.admin_totals_daily WHERE snapshot_date = v_yday;
  IF v_prev IS NULL THEN
    v_prev := public.admin_totals_as_of(v_yday);
    v_src  := 'recomputed';
  ELSE
    v_src  := 'snapshot';
  END IF;

  RETURN public.admin_totals_now()
    || jsonb_build_object('prev', v_prev, 'prev_date', v_yday, 'prev_source', v_src);
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.admin_totals() TO authenticated;
