-- ============================================================
-- Migration: 071 - 랭킹 변동 history (일일 스냅샷, 무한 보존)
-- 작성일: 2026-06-03
-- 설명:
--   - rank_snapshots 테이블: 매일 KST 00:05 에 PUBLISHED 프로그램 별 참여자 랭킹 저장
--   - get_my_rank_change(): 어제 등수 vs 현재 등수 비교 → 클라이언트가 ▲N 표시
--   - 보존 기간: 무한 (본인 결정). 장기 history 가능. 운영자 늘면 추후 archive 정책 고려.
--
-- pg_cron 의존:
--   - Supabase Dashboard > Database > Extensions 에서 pg_cron 사전 활성화 필요
--   - 이 migration 의 CREATE EXTENSION IF NOT EXISTS pg_cron; 으로도 활성화 시도
--   - cron 스케줄은 UTC 기준 → KST 00:05 = UTC 15:05 (전날)
--
-- 복구:
--   supabase/rollbacks/071_revert_rank_snapshots.sql 수동 실행 → 테이블·함수·cron 제거.
-- ============================================================

-- ─── 0) pg_cron extension (Supabase) ─────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- ─── 1) rank_snapshots 테이블 ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rank_snapshots (
  program_id    UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,                              -- KST 기준 날짜
  rank          INT NOT NULL,
  total_score   INT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (program_id, user_id, snapshot_date)
);

-- 프로그램별 특정 날짜 조회 (관리자용)
CREATE INDEX IF NOT EXISTS idx_rank_snapshots_program_date
  ON public.rank_snapshots (program_id, snapshot_date DESC);

-- 본인 history 조회 (사용자별)
CREATE INDEX IF NOT EXISTS idx_rank_snapshots_user_date
  ON public.rank_snapshots (user_id, snapshot_date DESC);


-- ─── 2) RLS — 본인 행만 SELECT 가능 ─────────────────────────
ALTER TABLE public.rank_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rank_snapshots_own_select" ON public.rank_snapshots;
CREATE POLICY "rank_snapshots_own_select" ON public.rank_snapshots
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT/UPDATE/DELETE 는 SECURITY DEFINER 함수만 허용 (정책 없음 = 차단)


-- ─── 3) snapshot_program_rankings — 특정 프로그램 오늘 스냅샷 저장/갱신 ──
CREATE OR REPLACE FUNCTION public.snapshot_program_rankings(p_program_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;
  v_count INT;
BEGIN
  INSERT INTO public.rank_snapshots (program_id, user_id, snapshot_date, rank, total_score)
  SELECT
    p_program_id,
    pp.user_id,
    v_today,
    RANK() OVER (ORDER BY COALESCE(SUM(sl.point), 0) DESC)::int AS rank,
    COALESCE(SUM(sl.point), 0)::int AS total_score
  FROM public.program_participants pp
  LEFT JOIN public.score_ledgers sl
    ON sl.user_id = pp.user_id
    AND sl.program_id = pp.program_id
  WHERE pp.program_id = p_program_id
    AND pp.status = 'ACTIVE'
  GROUP BY pp.user_id
  ON CONFLICT (program_id, user_id, snapshot_date)
  DO UPDATE SET
    rank = EXCLUDED.rank,
    total_score = EXCLUDED.total_score;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ─── 4) snapshot_all_active_programs — 모든 PUBLISHED 프로그램 일괄 스냅샷 ──
-- cron 으로 매일 호출됨.
CREATE OR REPLACE FUNCTION public.snapshot_all_active_programs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program RECORD;
  v_total INT := 0;
BEGIN
  FOR v_program IN
    SELECT id FROM public.programs WHERE status = 'PUBLISHED'
  LOOP
    v_total := v_total + public.snapshot_program_rankings(v_program.id);
  END LOOP;
  RETURN v_total;
END;
$$;


-- ─── 5) get_my_rank_change — 어제 vs 현재 등수 비교 (클라이언트용) ──
-- 양수 = 상승 (어제 5등 → 오늘 3등 이면 5 - 3 = 2)
-- 0 = 변동 없음
-- 음수 = 하락
-- NULL = 어제 데이터 없음 (신규 참여자) 또는 현재 미참여
CREATE OR REPLACE FUNCTION public.get_my_rank_change(p_program_id UUID)
RETURNS TABLE (
  yesterday_rank INT,
  current_rank   INT,
  rank_change    INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_yesterday DATE := ((NOW() AT TIME ZONE 'Asia/Seoul')::DATE - 1);
  v_y_rank    INT;
  v_c_rank    INT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- 어제 스냅샷에서 본인 등수
  SELECT rank INTO v_y_rank
  FROM public.rank_snapshots
  WHERE program_id = p_program_id
    AND user_id = v_user_id
    AND snapshot_date = v_yesterday;

  -- 현재 등수 (실시간 — 기존 get_program_ranking 재활용)
  SELECT r.rank INTO v_c_rank
  FROM public.get_program_ranking(p_program_id) r
  WHERE r.user_id = v_user_id;

  RETURN QUERY SELECT
    v_y_rank,
    v_c_rank,
    CASE
      WHEN v_y_rank IS NULL OR v_c_rank IS NULL THEN NULL
      ELSE v_y_rank - v_c_rank
    END;
END;
$$;


-- ─── 6) GRANT — 인증 사용자가 호출 가능한 함수만 ─────────────
GRANT EXECUTE ON FUNCTION public.get_my_rank_change(UUID) TO authenticated;
-- snapshot_* 은 cron 만 호출 (SECURITY DEFINER 라 GRANT 불필요)


-- ─── 7) pg_cron 스케줄 — 매일 KST 00:05 스냅샷 ──────────────
-- pg_cron 은 UTC 기준 → KST 00:05 = UTC 15:05 (전날)
-- 기존 스케줄 있으면 갱신 (재실행 안전)
DO $$
BEGIN
  PERFORM cron.unschedule('snapshot-rankings-daily') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'snapshot-rankings-daily'
  );
EXCEPTION WHEN OTHERS THEN
  NULL;  -- pg_cron 미설치 시에도 migration 통과 (수동 등록 가능)
END $$;

SELECT cron.schedule(
  'snapshot-rankings-daily',
  '5 15 * * *',   -- UTC 15:05 = KST 00:05
  $$SELECT public.snapshot_all_active_programs();$$
);


-- ─── 8) 초기 1회 스냅샷 — migration 실행 직후 오늘 데이터 생성 ──
-- 이걸 안 하면 첫 24시간 동안 "어제 데이터" 가 없어 ▲N 표시 X
SELECT public.snapshot_all_active_programs();
