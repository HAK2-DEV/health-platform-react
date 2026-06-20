-- ============================================================
-- Migration: 101 - 신고 자동 숨김 'off' 정책 지원
-- 작성일: 2026-06-20
-- 설명:
--   community_settings.reportPolicy = 'off' 이면 신고가 누적돼도
--   자동으로 숨기지 않음(운영자가 직접 관리). 기존 'auto'/'3'/'5' 는 동일.
--   100 의 report_auto_hide() 를 교체 — 'off' 일 때 즉시 RETURN.
--
-- 복구: 100 의 report_auto_hide() 본문으로 되돌리면 됨.
-- ============================================================

CREATE OR REPLACE FUNCTION public.report_auto_hide()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_policy TEXT;
  v_threshold INT;
  v_count INT;
BEGIN
  SELECT community_settings->>'reportPolicy' INTO v_policy FROM public.programs WHERE id = NEW.program_id;

  -- 'off' → 자동 숨김 안 함 (운영자 직접 관리)
  IF v_policy = 'off' THEN
    RETURN NEW;
  END IF;

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
