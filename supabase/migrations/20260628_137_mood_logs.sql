-- ============================================================
-- Migration: 137 - 오늘의 기분 체크 (금연 테마 전용 위젯)
-- 작성일: 2026-06-28
-- 설명:
--   금연 테마 프로그램의 "오늘의 기분 체크"(5단계 이모지) 저장용 테이블.
--   미션 시스템과 별개(본인 결정 B) — 점수/인증 아닌 매일 체크인.
--   하루 1건(program+user+date 유니크, upsert 로 갱신).
--
-- RLS:
--   - 본인 기록 CRUD (user_id = auth.uid())
--   - 운영자는 자기 프로그램 기록 SELECT (추후 기분 통계용)
--
-- 영향: 신규 테이블 1개. 기존 동작 불변.
--
-- 복구:
--   DROP TABLE IF EXISTS public.mood_logs;
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mood_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mood        SMALLINT NOT NULL CHECK (mood BETWEEN 1 AND 5),  -- 5=상쾌 ~ 1=힘들
  logged_date DATE NOT NULL,                                   -- KST 기준 날짜
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, user_id, logged_date)
);

CREATE INDEX IF NOT EXISTS mood_logs_program_user_idx
  ON public.mood_logs (program_id, user_id, logged_date);

ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;

-- 본인 기록 CRUD
DROP POLICY IF EXISTS mood_logs_own ON public.mood_logs;
CREATE POLICY mood_logs_own ON public.mood_logs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 운영자: 자기 프로그램 기록 조회 (통계)
DROP POLICY IF EXISTS mood_logs_owner_read ON public.mood_logs;
CREATE POLICY mood_logs_owner_read ON public.mood_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = mood_logs.program_id AND p.owner_id = auth.uid()
  ));
