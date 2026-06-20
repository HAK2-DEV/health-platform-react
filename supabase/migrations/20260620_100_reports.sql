-- ============================================================
-- Migration: 100 - 신고(reports) + 정책 기반 자동 숨김
-- 작성일: 2026-06-20
-- 설명:
--   게시판 글(community_posts) / 미션 인증(verifications) 신고.
--   누적 신고수가 프로그램 신고 정책(community_settings.reportPolicy) 임계값에
--   도달하면 자동 숨김:
--     'auto' (기본) → 1회, '3' → 3회, '5' → 5회
--     community_posts.status = 'hidden' / verifications.feed_visible = false
--   중복 신고 방지: UNIQUE(target_type, target_id, reporter_id)
--
-- 복구: DROP TABLE reports; + 트리거/함수 DROP.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'verification')),
  target_id UUID NOT NULL,
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_program ON public.reports(program_id);

-- ─── 자동 숨김 트리거 ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_auto_hide()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_policy TEXT;
  v_threshold INT;
  v_count INT;
BEGIN
  SELECT community_settings->>'reportPolicy' INTO v_policy FROM public.programs WHERE id = NEW.program_id;
  v_threshold := CASE v_policy WHEN '3' THEN 3 WHEN '5' THEN 5 ELSE 1 END;  -- 'auto'/NULL → 1

  SELECT count(*) INTO v_count FROM public.reports
   WHERE target_type = NEW.target_type AND target_id = NEW.target_id;

  IF v_count >= v_threshold THEN
    IF NEW.target_type = 'post' THEN
      UPDATE public.community_posts SET status = 'hidden' WHERE id = NEW.target_id AND status <> 'hidden';
    ELSIF NEW.target_type = 'verification' THEN
      UPDATE public.verifications SET feed_visible = false WHERE id = NEW.target_id AND feed_visible = true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_auto_hide ON public.reports;
CREATE TRIGGER reports_auto_hide
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.report_auto_hide();

-- ─── RLS ──────────────────────────────────────────────────
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 신고: 본인 명의 + 해당 프로그램 참여자/운영자
DROP POLICY IF EXISTS "reports insert" ON public.reports;
CREATE POLICY "reports insert" ON public.reports
FOR INSERT TO authenticated
WITH CHECK (
  reporter_id = auth.uid()
  AND (
    public._is_active_participant(program_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.owner_id = auth.uid())
  )
);

-- 조회: 본인 신고 / 운영자(중복·통계 확인용)
DROP POLICY IF EXISTS "reports select" ON public.reports;
CREATE POLICY "reports select" ON public.reports
FOR SELECT TO authenticated
USING (
  reporter_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.owner_id = auth.uid())
);

-- 삭제: 운영자 (신고 정리)
DROP POLICY IF EXISTS "reports delete" ON public.reports;
CREATE POLICY "reports delete" ON public.reports
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.owner_id = auth.uid())
);
