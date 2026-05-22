-- ============================================================
-- ROLLBACK: 033 - 점수 부여 트리거를 020 원본으로 복원
-- 작성일: 2026-05-22
-- 짝: supabase/migrations/20260522_033_score_guard_mission_schedule.sql
--
-- ⚠️ 수동 실행 전용. 020 의 grant_score_on_approval 본문을 그대로 복원.
--    (트리거 등록은 020 에 그대로 살아있으므로 함수만 덮어쓰면 됨)
-- ============================================================

CREATE OR REPLACE FUNCTION public.grant_score_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission RECORD;
  v_today_count INT;
  v_reason TEXT;
BEGIN
  IF NEW.status != 'APPROVED' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED' THEN
    RETURN NEW;
  END IF;

  SELECT
    m.program_id,
    m.point,
    m.daily_limit,
    m.active_from,
    m.active_until,
    m.verification_type
  INTO v_mission
  FROM public.missions m
  WHERE m.id = NEW.mission_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_mission.active_from IS NOT NULL
     AND NEW.submitted_at < v_mission.active_from THEN
    RETURN NEW;
  END IF;
  IF v_mission.active_until IS NOT NULL
     AND NEW.submitted_at > v_mission.active_until THEN
    RETURN NEW;
  END IF;

  IF v_mission.daily_limit IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_today_count
    FROM public.score_ledgers sl
    JOIN public.verifications v ON v.id = sl.verification_id
    WHERE v.mission_id = NEW.mission_id
      AND sl.user_id = NEW.user_id
      AND (sl.created_at AT TIME ZONE 'Asia/Seoul')::date
        = (NOW() AT TIME ZONE 'Asia/Seoul')::date;

    IF v_today_count >= v_mission.daily_limit THEN
      RETURN NEW;
    END IF;
  END IF;

  v_reason := CASE v_mission.verification_type
    WHEN 'AUTO'   THEN 'AUTO 인증 승인'
    WHEN 'MANUAL' THEN '수동 승인'
    ELSE '인증 승인'
  END;

  INSERT INTO public.score_ledgers (
    program_id, user_id, verification_id, point, reason
  )
  VALUES (
    v_mission.program_id,
    NEW.user_id,
    NEW.id,
    v_mission.point,
    v_reason
  )
  ON CONFLICT (verification_id) DO NOTHING;

  RETURN NEW;
END;
$$;
