-- ============================================================
-- Migration: 284 - screen_events 보관 기간 90일 (자동 삭제)
-- 작성일: 2026-10-06
-- 설명:
--   본인 결정(2026-10-06): 90일 지난 화면 이벤트는 지운다.
--
--   screen_events(146)는 화면을 옮길 때마다 한 행씩 쌓이는데 «지우는 장치가 없었다».
--   2026-10-06 실측 24,621행 — 아직 위험하진 않지만 사용자가 늘수록 가속되고,
--   용량 경보(255)를 울릴 1순위 후보였다. 마이그 279 주석에 «별도 과제»로만 적혀 있던 것.
--
--   왜 90일인가 — 이 테이블의 쓰임은 «요즘 어느 화면에서 오래 머무나/어디서 나가나»이고
--   (관리자 콘솔 화면 통계·DAU), 그 판단에 1년 전 기록은 쓰이지 않는다. 분석 가치는
--   유지하면서 무한 증식만 끊는다.
--
--   ⚠️ 집계는 «원본»을 쓴다 — 지우면 90일보다 긴 기간의 통계는 다시 못 본다.
--      지금 콘솔은 14일(admin_activity)·단기 화면 통계만 보므로 영향 없다.
--      나중에 장기 추이가 필요하면 «지우기 전에 일자별로 미리 집계해 두는» 표를 따로 만들 것.
--
--   pg_cron 의존 — 071·255 와 같은 방식. UTC 기준이라 KST 04:40 = UTC 19:40(전날).
--   새벽에 돌려 사용이 적은 시간에 지운다.
--
--   하위호환: 새 함수 + cron 1개. 기존 테이블·정책·동작 불변.
--   [[feedback_deploy_safety]]
--
-- 복구: supabase/rollbacks/284_revert_screen_events_retention.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 보관 기간이 지난 행 삭제. 한 번에 다 지우면 잠금이 길어지므로 상한을 둔다
--   (첫 실행은 쌓인 양이 많을 수 있다 — 매일 돌면서 따라잡는다).
CREATE OR REPLACE FUNCTION public.purge_old_screen_events(p_keep_days INT DEFAULT 90, p_limit INT DEFAULT 50000)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_deleted INT;
BEGIN
  WITH doomed AS (
    SELECT id FROM public.screen_events
     WHERE created_at < now() - make_interval(days => GREATEST(p_keep_days, 1))
     ORDER BY id
     LIMIT GREATEST(p_limit, 1)
  )
  DELETE FROM public.screen_events s USING doomed d WHERE s.id = d.id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$fn$;

-- 사람이 호출할 일은 없다(cron 전용). 익명 차단은 PUBLIC 만으론 안 된다
-- [[feedback_revoke_from_public_footgun]]
REVOKE ALL ON FUNCTION public.purge_old_screen_events(INT, INT) FROM PUBLIC, anon, authenticated;

-- 매일 KST 04:40 (= UTC 19:40 전날)
DO $$
BEGIN
  PERFORM cron.unschedule('purge-screen-events') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'purge-screen-events'
  );
END $$;

SELECT cron.schedule('purge-screen-events', '40 19 * * *', $cron$SELECT public.purge_old_screen_events();$cron$);
