-- ============================================================
-- Migration: 256 - 관리자 콘솔 RPC 5종
-- 작성일: 2026-09-07
-- 설명:
--   /admin 관리자 콘솔 화면이 쓰는 조회 전용 RPC.
--   전부 SECURITY DEFINER + public.is_admin() 가드 —
--   관리자가 아니면 NULL 또는 0행을 돌려준다(에러 대신 «빈 값»).
--
--   admin_capacity()        용량 현황(스토리지 버킷별 + DB) — 255 상태 테이블 참조
--   admin_totals()          서비스 전체 집계
--   admin_activity(days)    일자별 활동 추이(KST)
--   admin_operators()       운영자별 프로그램/참여자/인증 현황
--   admin_alerts()          «살펴볼 것» 문제 감지
--
--   ⚠️ verifications 에는 program_id 가 없다 — missions 를 거쳐 조인한다.
--   ⚠️ 255 가 먼저 적용되어 있어야 한다(capacity_alert_state 참조).
--
-- 영향:
--   신규 함수 5개만 추가. 기존 테이블/정책 변경 없음 — 클라이언트 무관하게 안전.
--
-- 복구:
--   supabase/rollbacks/256_revert_admin_console_rpcs.sql
-- ============================================================

-- ── 1) 용량 현황 ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_capacity()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_state   public.capacity_alert_state;
  v_storage BIGINT;
  v_db      BIGINT;
  v_buckets JSONB;
BEGIN
  IF NOT public.is_admin() THEN RETURN NULL; END IF;

  SELECT * INTO v_state FROM public.capacity_alert_state WHERE id = 1;

  SELECT coalesce(sum(nullif(o.metadata->>'size', '')::BIGINT), 0)
    INTO v_storage FROM storage.objects o;

  v_db := pg_database_size(current_database());

  SELECT coalesce(
           jsonb_agg(jsonb_build_object(
             'bucket', t.bucket_id, 'objects', t.objects, 'bytes', t.bytes
           ) ORDER BY t.bytes DESC), '[]'::JSONB)
    INTO v_buckets FROM public.get_storage_usage() t;

  RETURN jsonb_build_object(
    'storage_bytes',   v_storage,
    'storage_limit',   v_state.storage_limit_bytes,
    'storage_band',    v_state.storage_last_band,
    'db_bytes',        v_db,
    'db_limit',        v_state.db_limit_bytes,
    'db_band',         v_state.db_last_band,
    'last_checked_at', v_state.last_checked_at,
    'buckets',         v_buckets
  );
END;
$fn$;

-- ── 2) 서비스 전체 집계 ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_totals()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT CASE WHEN public.is_admin() THEN jsonb_build_object(
    'users',         (SELECT count(*) FROM public.users),
    'programs',      (SELECT count(*) FROM public.programs),
    'published',     (SELECT count(*) FROM public.programs WHERE status = 'PUBLISHED'),
    'participants',  (SELECT count(*) FROM public.program_participants WHERE status = 'ACTIVE'),
    'verifications', (SELECT count(*) FROM public.verifications),
    'posts',         (SELECT count(*) FROM public.community_posts),
    'push_subs',     (SELECT count(*) FROM public.push_subscriptions),
    'sessions',      (SELECT count(*) FROM public.sessions)
  ) ELSE NULL END;
$fn$;

-- ── 3) 일자별 활동 추이 (KST) ────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_activity(p_days INT DEFAULT 14)
RETURNS TABLE (day DATE, verify_count BIGINT, post_count BIGINT, join_count BIGINT)
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
      WHERE (pp.joined_at AT TIME ZONE 'Asia/Seoul')::date = s.dd)::BIGINT
  FROM span s
  WHERE public.is_admin()
  ORDER BY s.dd;
$fn$;

-- ── 4) 운영자별 현황 ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_operators()
RETURNS TABLE (
  operator_id       UUID,
  operator_name     TEXT,
  operator_email    TEXT,
  program_count     BIGINT,
  participant_count BIGINT,
  verify_count      BIGINT,
  last_activity     TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT u.id, u.nickname, u.email,
    (SELECT count(*) FROM public.programs p WHERE p.owner_id = u.id)::BIGINT,
    (SELECT count(*) FROM public.program_participants pp
       JOIN public.programs p2 ON p2.id = pp.program_id
      WHERE p2.owner_id = u.id AND pp.status = 'ACTIVE')::BIGINT,
    (SELECT count(*) FROM public.verifications v
       JOIN public.missions m  ON m.id  = v.mission_id
       JOIN public.programs p3 ON p3.id = m.program_id
      WHERE p3.owner_id = u.id)::BIGINT,
    (SELECT max(v2.submitted_at) FROM public.verifications v2
       JOIN public.missions m2  ON m2.id  = v2.mission_id
       JOIN public.programs p4  ON p4.id  = m2.program_id
      WHERE p4.owner_id = u.id)
  FROM public.users u
  WHERE public.is_admin()
    AND EXISTS (SELECT 1 FROM public.programs p5 WHERE p5.owner_id = u.id)
  ORDER BY 5 DESC, 4 DESC;
$fn$;

-- ── 5) 살펴볼 것 (문제 감지) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_alerts()
RETURNS TABLE (
  kind       TEXT,
  severity   TEXT,
  headline   TEXT,
  detail     TEXT,
  target_id  UUID
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH prog AS (
    SELECT p.id, p.name, p.start_date, p.end_date, p.published_at,
      (SELECT count(*) FROM public.program_participants pp
        WHERE pp.program_id = p.id AND pp.status = 'ACTIVE') AS participants,
      (SELECT count(*) FROM public.verifications v
         JOIN public.missions m ON m.id = v.mission_id
        WHERE m.program_id = p.id) AS verifies,
      (SELECT max(x.at) FROM (
         SELECT v.submitted_at AS at FROM public.verifications v
           JOIN public.missions m ON m.id = v.mission_id WHERE m.program_id = p.id
         UNION ALL
         SELECT c.created_at FROM public.community_posts c WHERE c.program_id = p.id
       ) x) AS last_at
    FROM public.programs p
    WHERE p.status = 'PUBLISHED'
  )
  -- 시작했는데 인증 0건
  SELECT 'no_verification', 'warn',
         g.name || ' — 인증 0건',
         '시작 ' || ((now() AT TIME ZONE 'Asia/Seoul')::date - g.start_date + 1)
           || '일차 · 참여 ' || g.participants || '명',
         g.id
  FROM prog g
  WHERE public.is_admin()
    AND g.start_date IS NOT NULL
    AND g.start_date <= (now() AT TIME ZONE 'Asia/Seoul')::date
    AND g.participants > 0 AND g.verifies = 0

  UNION ALL
  -- 진행 중인데 14일째 활동 없음
  SELECT 'stale', 'warn',
         g.name || ' — 14일째 조용',
         '마지막 활동 ' || to_char(g.last_at AT TIME ZONE 'Asia/Seoul', 'MM-DD'),
         g.id
  FROM prog g
  WHERE public.is_admin()
    AND g.verifies > 0
    AND g.last_at < now() - interval '14 days'
    AND (g.end_date IS NULL OR g.end_date >= (now() AT TIME ZONE 'Asia/Seoul')::date)

  UNION ALL
  -- 게시했는데 참여자 0명
  SELECT 'no_participant', 'info',
         g.name || ' — 참여자 없음',
         '게시 후 ' || ((now() AT TIME ZONE 'Asia/Seoul')::date - (g.published_at AT TIME ZONE 'Asia/Seoul')::date)
           || '일 경과',
         g.id
  FROM prog g
  WHERE public.is_admin()
    AND g.participants = 0
    AND g.published_at IS NOT NULL
    AND g.published_at < now() - interval '3 days'

  UNION ALL
  -- 용량 임계치 (255 상태 테이블)
  SELECT 'capacity',
         CASE WHEN greatest(s.sb, s.db) >= 90 THEN 'danger' ELSE 'warn' END,
         '용량 ' || greatest(s.sb, s.db) || '% 도달',
         '스토리지 ' || s.sb || '% · DB ' || s.db || '%',
         NULL::UUID
  FROM (SELECT storage_last_band AS sb, db_last_band AS db
        FROM public.capacity_alert_state WHERE id = 1) s
  WHERE public.is_admin() AND greatest(s.sb, s.db) >= 70;
$fn$;

-- ── 권한 ─────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.admin_capacity()        FROM public;
REVOKE ALL ON FUNCTION public.admin_totals()          FROM public;
REVOKE ALL ON FUNCTION public.admin_activity(INT)     FROM public;
REVOKE ALL ON FUNCTION public.admin_operators()       FROM public;
REVOKE ALL ON FUNCTION public.admin_alerts()          FROM public;

GRANT EXECUTE ON FUNCTION public.admin_capacity()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_totals()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activity(INT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operators()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_alerts()       TO authenticated;
