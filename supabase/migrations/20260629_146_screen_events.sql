-- ============================================================
-- Migration: 146 - screen_events (자체 화면 체류 분석 — UI/UX 개선용)
-- 작성일: 2026-06-29
-- 설명:
--   화면별 체류시간/방문수를 본인 DB에만 기록(제3자 전송 없음 → 민감정보 리스크 회피).
--   ※ 콘텐츠·사진·건강값은 일절 저장 안 함. 정규화된 화면 키(예 '/programs/:id?tab=missions')
--      + 체류시간(ms) + user_id 만 저장. 화면 키는 ID/민감 파라미터 제거된 패턴.
--
-- RLS:
--   - INSERT: 본인 이벤트만 (user_id = auth.uid())
--   - SELECT: 관리자(is_admin())만 — 운영자/참가자에게 노출 안 함(플랫폼 분석용)
--
-- 영향: 신규 테이블 1개. 기존 동작 불변. 코드(로깅)는 적용 후 배포.
--
-- 복구:
--   DROP TABLE IF EXISTS public.screen_events;
-- ============================================================

CREATE TABLE IF NOT EXISTS public.screen_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  screen      TEXT NOT NULL,                 -- 정규화 화면 키 (ID/민감 파라미터 제거)
  duration_ms INTEGER NOT NULL,              -- 체류시간(ms)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_screen_events_screen ON public.screen_events(screen);
CREATE INDEX IF NOT EXISTS idx_screen_events_created ON public.screen_events(created_at);

ALTER TABLE public.screen_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert own screen event" ON public.screen_events;
CREATE POLICY "insert own screen event" ON public.screen_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin read screen events" ON public.screen_events;
CREATE POLICY "admin read screen events" ON public.screen_events
  FOR SELECT TO authenticated
  USING (public.is_admin());
