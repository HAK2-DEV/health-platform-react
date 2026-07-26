-- ============================================================
-- Migration: 168 - 자동 숨김 트리거, 미처리 신고만 카운트
-- 작성일: 2026-07-26
-- 설명:
--   report_auto_hide() 가 임계값을 계산할 때 전체 신고 수를 세던 것을
--   '미처리(resolved = false)' 신고만 세도록 변경.
--   · 기존: 운영자가 오신고를 '다시 노출'(복구)로 되살려도, 이후 새 신고 1건이
--     들어오면 과거의 처리된 신고까지 합산돼 임계값을 넘어 즉시 재숨김됨 →
--     복구가 사실상 무력. (100번 트리거는 resolved 필터가 없었음)
--   · 변경: 처리 완료된 신고는 카운트에서 제외. 복구 시 그 콘텐츠의 신고가
--     모두 resolved=true 로 넘어가므로(resolve_reports), 되살린 글은 새로운
--     신고가 임계값만큼 다시 쌓이기 전까지 노출이 유지됨.
--   116번 설계 주석("새 신고가 또 들어오면 resolved=false → 다시 미처리로 잡힘")과
--   트리거 동작을 일치시키는 것. 영향: reports 테이블 트리거 함수 하나.
--
-- 하위호환: CREATE OR REPLACE FUNCTION (additive). 컬럼/정책 변경 없음.
--   resolved 컬럼은 116번에서 이미 존재. 미처리 신고 수는 종전 전체 수 이하이므로
--   숨김이 더 느슨해지는 방향(권한 넓힘)이라 기존 콘텐츠를 새로 차단하지 않음.
--
-- 복구:
--   아래 함수를 100번 원본(전체 count(*)) 으로 CREATE OR REPLACE 하면 원복.
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
  v_threshold := CASE v_policy WHEN '3' THEN 3 WHEN '5' THEN 5 ELSE 1 END;  -- 'auto'/NULL → 1

  -- 미처리(resolved=false) 신고만 카운트 — 운영자가 처리(복구/처리완료)한 신고는 제외.
  SELECT count(*) INTO v_count FROM public.reports
   WHERE target_type = NEW.target_type AND target_id = NEW.target_id
     AND resolved = false;

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
