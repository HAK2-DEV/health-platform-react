-- ============================================================
-- Migration: 084 - 미션 입력별 점수 + 필수/선택
-- 작성일: 2026-06-12
-- 설명:
--   한 미션에 여러 인증 입력(사진/기록/소감)을 걸 때, 입력마다
--   (1) 필수/선택 여부와 (2) 개별 점수를 줄 수 있게 함.
--   예) 사진(필수 7P) + 소감(선택 +3P) → 사진만 7P, 소감까지 10P.
--
--   추가 컬럼 (missions):
--     image_point / numeric_point / note_point   INT  NULL  — 입력별 점수
--     image_required / numeric_required / note_required  BOOL  DEFAULT true — 제출 필수 여부
--
--   채점 규칙 (grant_score_on_approval 재정의):
--     - per-input 모드(= *_point 중 하나라도 NOT NULL): 실제 제출된 입력의 점수만 합산
--         · 사진 제출 = image_path IS NOT NULL → + image_point
--         · 기록 제출 = numeric_value IS NOT NULL → + numeric_point
--         · 소감 제출 = note 가 공백 아님 → + note_point
--     - legacy 모드(*_point 전부 NULL): 기존처럼 mission.point 단일 부여 → 하위호환
--     - 합산 점수 0 이하이면 score_ledgers 미생성 (선택 입력만 있고 미제출 등)
--
--   대표 점수: missions.point 에는 "최대 점수(다 했을 때 합계)"를 저장 (코드가 갱신).
--     랭킹/하루최대/카드 표시는 기존대로 missions.point 사용.
--
--   필수/선택의 제출 검증은 클라이언트(MissionVerifyPage)에서 수행.
--   트리거는 점수만 계산 — 선택 입력 미제출이어도 verification 은 그대로 보존.
--
-- 복구: 033 의 grant_score_on_approval() 로 OR REPLACE 복원 + 컬럼 DROP.
-- ============================================================

-- ─── 1) missions 컬럼 추가 ───────────────────────────────────
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS image_point      INT,
  ADD COLUMN IF NOT EXISTS numeric_point    INT,
  ADD COLUMN IF NOT EXISTS note_point       INT,
  ADD COLUMN IF NOT EXISTS image_required   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS numeric_required BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS note_required    BOOLEAN NOT NULL DEFAULT true;

-- ─── 2) 채점 트리거 재정의 (033 기반 + per-input 합산) ────────
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
      AND (sl.created_at AT TIME ZONE 'Asia/Seoul')::date = v_submitted_kst_date;

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
    IF NEW.numeric_value IS NOT NULL THEN
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
