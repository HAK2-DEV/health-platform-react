-- ============================================================
-- Migration: 276 - 제출한 입력만 점수 합산 (169 회귀 복구)
-- 작성일: 2026-09-29
-- 설명:
--   169(daily_limit 기준 변경)가 grant_score_on_approval() 을 다시 쓰면서
--   084 의 «입력별 점수 합산» 과 033 의 요일·제외기간 검사를 빠뜨려,
--   선택 입력(소감 등)을 내지 않아도 항상 missions.point(최대 점수)를 줬다.
--   (BUG_LOG 18 — 사진만 냈는데 사진 10 + 소감 5 = 15점 기록)
--   입력별 합산과 일정 검사를 되살리고, 169 의 «제출일 기준 daily_limit» 은 유지.
--   수치는 numeric_value(0 포함) 또는 값이 든 metric_values 가 있으면 1회 인정.
--   입력별 점수가 없는 옛 미션은 기존처럼 missions.point 단일 점수.
--   앞으로의 승인에만 적용 — 이미 쌓인 score_ledgers 는 건드리지 않는다.
-- 하위호환: CREATE OR REPLACE(시그니처 동일, 트리거 재바인딩 불필요). 클라 배포 전에 적용.
-- 검증: supabase/tests/276_input_scoring.sql (17케이스, PGlite 통과 · 169 본문으로는 photo=15 로 실패)
-- 복구: supabase/rollbacks/276_revert_input_scoring.sql
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
  v_award INT;
BEGIN
  -- APPROVED 가 아니면 무시
  IF NEW.status != 'APPROVED' THEN
    RETURN NEW;
  END IF;

  -- UPDATE 시: 이전에도 APPROVED 였으면 중복 부여 방지
  IF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED' THEN
    RETURN NEW;
  END IF;

  -- 미션 정보 조회 (일정 + 입력별 점수 컬럼 포함)
  SELECT
    m.program_id,
    m.point,
    m.daily_limit,
    m.active_from,
    m.active_until,
    m.verification_type,
    m.schedule_mode,
    m.active_days,
    m.excluded_periods,
    m.image_point,
    m.numeric_point,
    m.note_point
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
      AND (v.submitted_at AT TIME ZONE 'Asia/Seoul')::date = v_submitted_kst_date;

    IF v_today_count >= v_mission.daily_limit THEN
      RETURN NEW;
    END IF;
  END IF;

  -- ── 부여 점수 계산 ───────────────────────────────────────
  IF v_mission.image_point IS NOT NULL
     OR v_mission.numeric_point IS NOT NULL
     OR v_mission.note_point IS NOT NULL THEN
    -- per-input 모드: 실제 제출된 입력의 점수만 합산
    v_award := 0;
    IF NEW.image_path IS NOT NULL THEN
      v_award := v_award + COALESCE(v_mission.image_point, 0);
    END IF;
    IF NEW.numeric_value IS NOT NULL OR EXISTS (
      SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(NEW.metric_values) = 'object'
        THEN NEW.metric_values ELSE '{}'::jsonb END) AS metric(key, value)
      WHERE jsonb_typeof(value) = 'number'
         OR (jsonb_typeof(value) = 'array' AND value <> '[]'::jsonb)
    ) THEN
      v_award := v_award + COALESCE(v_mission.numeric_point, 0);
    END IF;
    IF NEW.note IS NOT NULL AND length(btrim(NEW.note)) > 0 THEN
      v_award := v_award + COALESCE(v_mission.note_point, 0);
    END IF;
  ELSE
    -- legacy: 단일 점수
    v_award := v_mission.point;
  END IF;

  -- 부여할 점수 없으면 ledger 미생성
  IF v_award IS NULL OR v_award <= 0 THEN
    RETURN NEW;
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
    v_award,
    v_reason
  )
  ON CONFLICT (verification_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 트리거는 020 에서 이미 등록되어 있고 함수만 OR REPLACE 로 덮어썼으므로 재등록 불필요.
