-- ============================================================
-- Migration: 020 - verifications APPROVED → score_ledgers 자동 INSERT 트리거
-- 작성일: 2026-05-20
-- 설명: 점수 엔진의 핵심. SSRD F-SCORE-010/020/030 구현.
--
-- 동작:
--   verifications.status 가 APPROVED 가 되는 시점에 발화
--     - INSERT 시: AUTO 미션이라 018 BEFORE 트리거가 status='APPROVED' 설정한 케이스
--     - UPDATE 시: MANUAL 미션의 PENDING_REVIEW → APPROVED 전환
--   다음 조건을 모두 통과해야 점수 부여:
--     1) 미션의 active_from ~ active_until 활성 기간 안
--     2) 본인의 같은 미션 KST 오늘 점수 부여 카운트 < daily_limit
--   통과 시 score_ledgers INSERT (point = mission.point)
--   실패 시 verifications 는 APPROVED 로 남지만 점수만 미부여 (활동 기록은 보존)
--
-- 시간대: KST(Asia/Seoul) 기준 일자 판단.
--   본인의 formatters.getTodayKST() 와 같은 기준.
--
-- daily_max_score (프로그램 전체 하루 점수 상한) 는 본 트리거에서 미구현.
--   필요 시 별도 마이그레이션으로 진화.
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
  -- APPROVED 가 아니면 무시
  IF NEW.status != 'APPROVED' THEN
    RETURN NEW;
  END IF;

  -- UPDATE 시: 이전에도 APPROVED 였으면 중복 부여 방지
  IF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED' THEN
    RETURN NEW;
  END IF;

  -- 미션 정보 조회
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

  -- 활성 기간 검증 (둘 다 NULLable — NULL 이면 검증 생략)
  IF v_mission.active_from IS NOT NULL
     AND NEW.submitted_at < v_mission.active_from THEN
    RETURN NEW;
  END IF;
  IF v_mission.active_until IS NOT NULL
     AND NEW.submitted_at > v_mission.active_until THEN
    RETURN NEW;
  END IF;

  -- daily_limit 검증 (KST 기준 오늘 같은 미션 점수 부여 횟수)
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

  -- 사유 (감사·내역 표시용)
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


-- 트리거 등록 (INSERT 시 AUTO 즉시승인 + UPDATE 시 status 전환 둘 다 처리)
DROP TRIGGER IF EXISTS grant_score_after_verification ON public.verifications;
CREATE TRIGGER grant_score_after_verification
AFTER INSERT OR UPDATE OF status ON public.verifications
FOR EACH ROW
EXECUTE FUNCTION public.grant_score_on_approval();
