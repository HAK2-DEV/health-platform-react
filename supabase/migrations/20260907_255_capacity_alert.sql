-- ============================================================
-- Migration: 255 - 용량(스토리지 + DB) 임계치 도달 시 관리자 알림
-- 작성일: 2026-09-07
-- 설명:
--   Storage 사용량과 DB 크기가 각자 한도의 70/80/90/95% 를 넘으면
--   role=ADMIN 사용자에게 notifications 행을 INSERT 한다.
--   → 178 트리거(trg_notify_push)가 그대로 Web Push 까지 발송한다.
--
--   실사용 시작(2026-09-01) 이후 인증 사진이 쌓이기 시작해,
--   무료 한도에 닿기 «전에» 미리 알아야 대응할 수 있어 추가.
--
--   밴드(band) 방식으로 중복 알림을 막는다:
--     현재 밴드 > 마지막 알림 밴드 일 때만 발송.
--     사용량이 내려가면 밴드도 내려가 다시 알릴 수 있게 된다.
--   스토리지와 DB 는 밴드를 따로 관리한다(한쪽이 울려도 다른 쪽은 그대로).
--
--   한도는 capacity_alert_state 에서 조정한다.
--     Storage 무료 1GB=1073741824 / Pro 100GB=107374182400
--     DB      무료 500MB=524288000 / Pro 8GB=8589934592
--
-- 영향:
--   신규 테이블 public.capacity_alert_state
--   신규 함수 public.check_capacity_usage(), public.get_storage_usage()
--   notifications_type_check 에 'CAPACITY_WARNING' 추가 (기존 타입 전부 유지)
--   cron job 'check-capacity-usage' (매일 KST 09:00)
--
-- 복구:
--   supabase/rollbacks/255_revert_capacity_alert.sql
-- ============================================================

-- ── 1) 알림 상태 (싱글턴 행) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.capacity_alert_state (
  id                  SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  storage_limit_bytes BIGINT NOT NULL DEFAULT 1073741824,  -- 무료 1GB
  storage_last_band   SMALLINT NOT NULL DEFAULT 0,         -- 0/70/80/90/95
  storage_last_bytes  BIGINT,
  db_limit_bytes      BIGINT NOT NULL DEFAULT 524288000,   -- 무료 500MB
  db_last_band        SMALLINT NOT NULL DEFAULT 0,
  db_last_bytes       BIGINT,
  last_checked_at     TIMESTAMPTZ,
  last_notified_at    TIMESTAMPTZ
);

INSERT INTO public.capacity_alert_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.capacity_alert_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage capacity_alert_state" ON public.capacity_alert_state;
CREATE POLICY "admins manage capacity_alert_state"
ON public.capacity_alert_state
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ── 2) 알림 타입 확장 (233 목록 + CAPACITY_WARNING) ──────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'REVIEW_APPROVED', 'REVIEW_REJECTED', 'POST_LIKE', 'POST_COMMENT',
  'PARTICIPANT_JOINED', 'VERIFICATION_SUBMITTED', 'POST_PENDING',
  'POST_APPROVED', 'POST_REJECTED', 'REPORT_RECEIVED',
  'TEAM_INVITE', 'TEAM_JOINED', 'TEAM_REMOVED', 'TEAM_LEADER_CHANGED',
  'INQUIRY_RECEIVED', 'INQUIRY_ANSWERED',
  'OPERATOR_CHEER', 'CONTENT_HIDDEN',
  'NEW_MISSION', 'NEW_QUIZ', 'NEW_CLASS', 'NEW_NOTICE',
  'END_SURVEY_DUE',
  'CAPACITY_WARNING'
));

-- ── 3) 버킷별 사용량 (관리자 온디맨드) ────────────────────
CREATE OR REPLACE FUNCTION public.get_storage_usage()
RETURNS TABLE (bucket_id TEXT, objects BIGINT, bytes BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT o.bucket_id,
         count(*)::BIGINT,
         coalesce(sum(nullif(o.metadata->>'size', '')::BIGINT), 0)::BIGINT
  FROM storage.objects o
  WHERE public.is_admin()          -- 관리자가 아니면 0행
  GROUP BY o.bucket_id
  ORDER BY 3 DESC;
$fn$;

REVOKE ALL ON FUNCTION public.get_storage_usage() FROM public;
GRANT EXECUTE ON FUNCTION public.get_storage_usage() TO authenticated;

-- ── 4) 임계치 검사 + 관리자 알림 ─────────────────────────
CREATE OR REPLACE FUNCTION public.check_capacity_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  s_bytes BIGINT; s_limit BIGINT; s_last SMALLINT; s_pct NUMERIC; s_band SMALLINT;
  d_bytes BIGINT; d_limit BIGINT; d_last SMALLINT; d_pct NUMERIC; d_band SMALLINT;
  v_hit   BOOLEAN := false;
BEGIN
  SELECT storage_limit_bytes, storage_last_band, db_limit_bytes, db_last_band
    INTO s_limit, s_last, d_limit, d_last
  FROM public.capacity_alert_state WHERE id = 1;

  IF s_limit IS NULL OR s_limit <= 0 OR d_limit IS NULL OR d_limit <= 0 THEN
    RETURN;                       -- 미설정이면 아무것도 안 함
  END IF;

  SELECT coalesce(sum(nullif(o.metadata->>'size', '')::BIGINT), 0)
    INTO s_bytes FROM storage.objects o;
  d_bytes := pg_database_size(current_database());

  s_pct := round(s_bytes::NUMERIC * 100 / s_limit, 1);
  d_pct := round(d_bytes::NUMERIC * 100 / d_limit, 1);

  s_band := CASE WHEN s_pct >= 95 THEN 95 WHEN s_pct >= 90 THEN 90
                 WHEN s_pct >= 80 THEN 80 WHEN s_pct >= 70 THEN 70 ELSE 0 END;
  d_band := CASE WHEN d_pct >= 95 THEN 95 WHEN d_pct >= 90 THEN 90
                 WHEN d_pct >= 80 THEN 80 WHEN d_pct >= 70 THEN 70 ELSE 0 END;

  -- 밴드가 «올라갔을 때만» 알림 (같은 밴드에서 매일 재알림 방지)
  IF s_band > s_last THEN
    INSERT INTO public.notifications (user_id, type, title, body)
    SELECT u.id, 'CAPACITY_WARNING',
           '저장 용량 ' || s_band || '% 도달',
           '사진 저장 용량이 ' || pg_size_pretty(s_bytes) || ' / ' || pg_size_pretty(s_limit)
             || ' (' || s_pct || '%) 입니다. '
             || CASE WHEN s_band >= 90 THEN '한도가 얼마 안 남았어요. 지금 조치가 필요해요.'
                     ELSE '여유가 줄고 있어요. 요금제나 정리 계획을 확인하세요.' END
    FROM public.users u WHERE u.role = 'ADMIN';
    v_hit := true;
  END IF;

  IF d_band > d_last THEN
    INSERT INTO public.notifications (user_id, type, title, body)
    SELECT u.id, 'CAPACITY_WARNING',
           'DB 용량 ' || d_band || '% 도달',
           '데이터베이스 크기가 ' || pg_size_pretty(d_bytes) || ' / ' || pg_size_pretty(d_limit)
             || ' (' || d_pct || '%) 입니다. '
             || CASE WHEN d_band >= 90 THEN '한도가 얼마 안 남았어요. 지금 조치가 필요해요.'
                     ELSE '여유가 줄고 있어요. 요금제를 확인하세요.' END
    FROM public.users u WHERE u.role = 'ADMIN';
    v_hit := true;
  END IF;

  UPDATE public.capacity_alert_state
     SET storage_last_band  = s_band,
         storage_last_bytes = s_bytes,
         db_last_band       = d_band,
         db_last_bytes      = d_bytes,
         last_checked_at    = now(),
         last_notified_at   = CASE WHEN v_hit THEN now() ELSE last_notified_at END
   WHERE id = 1;
END;
$fn$;

-- ── 5) 매일 KST 09:00 (UTC 00:00) ────────────────────────
DO $do$
BEGIN
  PERFORM cron.unschedule('check-capacity-usage') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'check-capacity-usage'
  );
EXCEPTION WHEN others THEN NULL;
END $do$;

SELECT cron.schedule('check-capacity-usage', '0 0 * * *', $cron$SELECT public.check_capacity_usage();$cron$);
