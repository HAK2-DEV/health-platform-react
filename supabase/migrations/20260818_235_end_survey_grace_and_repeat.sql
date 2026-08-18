-- ============================================================
-- Migration: 235 - 종료 설문 유예(종료 후 7일) + 리마인드 반복·점증
-- 작성일: 2026-08-18
-- 설명:
--   G5 개선 — "종료 설문 시작"을 놓치면 종료 데이터가 비가역적으로 사라지는 절벽 완화.
--   1) 종료 가드(_guard_ended_programs, 마이그 190)에 예외 하나 추가:
--      종료된 프로그램이라도 「end_survey_started_at 을 null→시각으로 설정」만 하고,
--      종료 후 7일(end_date+7) 이내이며, 그 외 컬럼은 그대로면 허용.
--      → 운영자가 종료 후에도 유예 기간(7일) 안엔 종료 설문을 시작할 수 있음.
--      (무료 계정 종료 후 7일 내 프로그램 삭제 정책과 정합 — 유예도 7일.)
--   2) notify_end_survey_due(마이그 233) 재정의:
--      - 창을 D-3 ~ D+6 으로 확장(유예 종료 직전까지).
--      - 1회(notified_at null) → ~2일마다 반복(마지막 알림 44h 경과 시 재발송).
--      - 종료 전/후에 따라 문구 분기(후는 "유예 N일" 긴급 톤).
--
-- 하위호환: 함수 CREATE OR REPLACE 만(스키마 무변경). 기존 흐름 유지, 예외/반복만 추가.
-- 복구:
--   -- _guard_ended_programs 를 마이그 190 버전으로 되돌리고, notify_end_survey_due 를 233 버전으로 되돌림.
-- ============================================================

-- 1) 종료 가드 — 종료설문 시작(유예 7일) 예외 추가 -------------------------
CREATE OR REPLACE FUNCTION public._guard_ended_programs()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;      -- 서비스롤 예외
  IF public.is_admin() THEN RETURN NEW; END IF;       -- 관리자 예외
  IF OLD.end_date IS NOT NULL
     AND (now() AT TIME ZONE 'Asia/Seoul')::date > OLD.end_date THEN
    -- 예외: 종료설문 시작(null→시각)만 바꾸고, 종료 후 7일 이내이며, 그 외 컬럼 불변이면 허용.
    IF OLD.end_survey_started_at IS NULL
       AND NEW.end_survey_started_at IS NOT NULL
       AND (now() AT TIME ZONE 'Asia/Seoul')::date <= OLD.end_date + 7
       AND (to_jsonb(OLD) - 'end_survey_started_at' - 'end_survey_notified_at' - 'updated_at')
         = (to_jsonb(NEW) - 'end_survey_started_at' - 'end_survey_notified_at' - 'updated_at') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION '종료된 프로그램은 수정할 수 없어요'
      USING ERRCODE = 'P0001', HINT = 'program_ended';
  END IF;
  RETURN NEW;
END;
$$;

-- 2) 종료 임박·유예 알림 — 반복·점증 --------------------------------------
CREATE OR REPLACE FUNCTION public.notify_end_survey_due()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  WITH due AS (
    UPDATE public.programs p
      SET end_survey_notified_at = now()
    WHERE p.status = 'PUBLISHED'
      AND COALESCE(p.survey_enabled, false) = true
      AND p.end_survey_started_at IS NULL
      AND p.end_date IS NOT NULL
      AND (p.end_date - v_today) BETWEEN -6 AND 3          -- D-3 ~ D+6(유예 종료 직전)
      AND (p.end_survey_notified_at IS NULL
           OR p.end_survey_notified_at < now() - interval '44 hours')  -- ~2일마다 재발송
    RETURNING p.id, p.owner_id, p.name, p.end_date
  )
  INSERT INTO public.notifications (user_id, type, title, body, link_path)
  SELECT d.owner_id, 'END_SURVEY_DUE',
         CASE WHEN v_today > d.end_date
              THEN '🚨 종료 설문을 아직 시작 안 했어요'
              ELSE '종료 설문 준비' END,
         CASE WHEN v_today > d.end_date
              THEN d.name || ' — 종료됐어요. 지금 시작하면 아직 참여자 응답을 받을 수 있어요(종료 후 '
                   || GREATEST(0, 7 - (v_today - d.end_date))::text || '일 남음).'
              ELSE d.name || ' 마무리가 다가와요. 종료 설문 문항을 검토하고 시작하세요.' END,
         '/programs/' || d.id
  FROM due d;
END;
$$;
