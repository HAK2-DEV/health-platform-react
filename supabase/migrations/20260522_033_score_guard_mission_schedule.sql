-- ============================================================
-- Migration: 033 - 점수 부여 트리거에 미션 일정 가드 추가
-- 작성일: 2026-05-22
-- 설명: 020 의 grant_score_on_approval() 함수를 OR REPLACE 로 덮어씀.
--   미션의 schedule_mode / active_days / excluded_periods 가
--   인증 제출 시점(KST)을 통과해야만 점수 부여.
--   통과 못해도 verifications 는 그대로 보존 (활동 기록은 남김 — 점수만 미부여).
--
-- 추가 검증 (기존 active_from/until + daily_limit 외):
--   1) schedule_mode 검사
--      - 'ALL_DAYS' → 검사 생략 (모든 요일 허용)
--      - 'WEEKDAYS' → 월(1) ~ 금(5) 만 허용
--      - 'WEEKENDS' → 토(6), 일(7) 만 허용
--      - 'CUSTOM'   → active_days 배열에 포함된 요일만 허용
--   2) excluded_periods 검사
--      - 각 { start_date, end_date } 범위에 KST 오늘이 들어가면 점수 미부여
--
-- 요일 번호 규약:
--   ISO 8601 — 월=1 ... 일=7 (PostgreSQL EXTRACT(ISODOW FROM ...))
--   본인의 active_days 도 같은 규약 (009 마이그레이션 + Step1Basic.jsx)
--
-- 시간대:
--   submitted_at 을 Asia/Seoul 로 변환해서 일자/요일 판단.
--   기존 020 의 daily_limit 검사와 같은 KST 기준.
--
-- 복구:
--   supabase/rollbacks/033_revert_score_guard.sql 수동 실행으로 020 의 원본 함수 복원.
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
  v_submitted_kst_date DATE;
  v_submitted_dow INT;
  v_excluded JSONB;
BEGIN
  -- APPROVED 가 아니면 무시
  IF NEW.status != 'APPROVED' THEN
    RETURN NEW;
  END IF;

  -- UPDATE 시: 이전에도 APPROVED 였으면 중복 부여 방지
  IF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED' THEN
    RETURN NEW;
  END IF;

  -- 미션 정보 조회 (일정 컬럼 포함)
  SELECT
    m.program_id,
    m.point,
    m.daily_limit,
    m.active_from,
    m.active_until,
    m.verification_type,
    m.schedule_mode,
    m.active_days,
    m.excluded_periods
  INTO v_mission
  FROM public.missions m
  WHERE m.id = NEW.mission_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- 활성 기간 검증 (둘 다 NULLable — NULL 이면 검증 생략)
  IF v_mission.active_from IS NOT NULL
     AND NEW.submitted_at < v_mission.active_from THEN
    RETURN NEW;
  END IF;
  IF v_mission.active_until IS NOT NULL
     AND NEW.submitted_at > v_mission.active_until THEN
    RETURN NEW;
  END IF;

  -- KST 기준 제출 일자/요일 (이후 검증들의 공통 기반)
  v_submitted_kst_date := (NEW.submitted_at AT TIME ZONE 'Asia/Seoul')::date;
  v_submitted_dow := EXTRACT(ISODOW FROM NEW.submitted_at AT TIME ZONE 'Asia/Seoul')::int;

  -- schedule_mode 검증
  IF v_mission.schedule_mode = 'WEEKDAYS' AND v_submitted_dow NOT BETWEEN 1 AND 5 THEN
    RETURN NEW;
  END IF;
  IF v_mission.schedule_mode = 'WEEKENDS' AND v_submitted_dow NOT IN (6, 7) THEN
    RETURN NEW;
  END IF;
  IF v_mission.schedule_mode = 'CUSTOM'
     AND NOT (v_mission.active_days @> ARRAY[v_submitted_dow]) THEN
    RETURN NEW;
  END IF;
  -- ALL_DAYS 는 검사 생략

  -- excluded_periods 검증 (JSONB 배열 순회)
  FOR v_excluded IN
    SELECT * FROM jsonb_array_elements(COALESCE(v_mission.excluded_periods, '[]'::jsonb))
  LOOP
    IF (v_excluded->>'start_date') IS NOT NULL
       AND (v_excluded->>'end_date') IS NOT NULL
       AND v_submitted_kst_date >= (v_excluded->>'start_date')::date
       AND v_submitted_kst_date <= (v_excluded->>'end_date')::date THEN
      RETURN NEW;
    END IF;
  END LOOP;

  -- daily_limit 검증 (KST 기준 오늘 같은 미션 점수 부여 횟수)
  IF v_mission.daily_limit IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_today_count
    FROM public.score_ledgers sl
    JOIN public.verifications v ON v.id = sl.verification_id
    WHERE v.mission_id = NEW.mission_id
      AND sl.user_id = NEW.user_id
      AND (sl.created_at AT TIME ZONE 'Asia/Seoul')::date = v_submitted_kst_date;

    IF v_today_count >= v_mission.daily_limit THEN
      RETURN NEW;
    END IF;
  END IF;

  -- 사유
  v_reason := CASE v_mission.verification_type
    WHEN 'AUTO'   THEN 'AUTO 인증 승인'
    WHEN 'MANUAL' THEN '수동 승인'
    ELSE '인증 승인'
  END;

  -- 점수 부여 (verification_id UNIQUE 제약으로 중복 INSERT 차단)
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

-- 트리거는 020 에서 이미 등록되어 있고 함수만 OR REPLACE 로 덮어썼으므로 재등록 불필요.
