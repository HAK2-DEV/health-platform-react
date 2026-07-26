-- ============================================================
-- Migration: 169 - daily_limit 판정을 now() → 인증의 submitted_at 기준으로
-- 작성일: 2026-07-26
-- 설명:
--   미션 daily_limit(하루 인증 횟수) 판정이 두 곳에서 벽시계 now() 를 기준으로
--   '오늘'을 계산해, 자정 경계·백필(과거 날짜 인증)에서 어긋났다.
--     · 103 enforce_verification_daily_limit(): BEFORE INSERT 가드가
--       기존 인증의 submitted_at 이 (now KST)::date 와 같은지로 카운트 →
--       23:59 제출과 00:01 제출이 다른 날인데 같은 날로 묶이거나, 과거 날짜
--       인증을 넣으면 엉뚱하게 '오늘 것'만 세어 다건 삽입이 막힘.
--     · 020 grant_score_on_approval(): 채점의 daily_limit 도 score_ledger.created_at
--       이 (now KST)::date 인지로 카운트 → 같은 문제.
--   해결: 둘 다 '그 인증(NEW)의 submitted_at 이 속한 KST 날짜' 기준으로 카운트.
--     하루 = 인증이 찍힌 날. now() 에 의존하지 않음.
--
-- 하위호환: CREATE OR REPLACE 두 함수 (트리거 재바인딩 불필요, 시그니처 동일).
--   당일 제출(submitted_at≈now)엔 결과 동일 — 경계/백필에서만 정확해짐.
--
-- 복구: 103/020 원본 함수 본문으로 CREATE OR REPLACE.
-- ============================================================

-- ── 103 가드: BEFORE INSERT daily_limit 하드 차단 ──────────
CREATE OR REPLACE FUNCTION public.enforce_verification_daily_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_limit INT;
  v_count INT;
BEGIN
  SELECT m.daily_limit INTO v_limit
  FROM public.missions m
  WHERE m.id = NEW.mission_id;

  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  -- 이 인증(NEW)의 제출일(KST) 기준으로 같은 (user, mission) 의 비-REJECTED 인증 수
  SELECT COUNT(*)
  INTO v_count
  FROM public.verifications v
  WHERE v.mission_id = NEW.mission_id
    AND v.user_id = NEW.user_id
    AND v.status <> 'REJECTED'
    AND (v.submitted_at AT TIME ZONE 'Asia/Seoul')::date
      = (NEW.submitted_at AT TIME ZONE 'Asia/Seoul')::date;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'DAILY_LIMIT_REACHED'
      USING ERRCODE = 'P0001',
            HINT = 'daily_limit';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 020 채점: APPROVED 시 점수 부여 (daily_limit 판정만 정정) ──
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
    m.program_id, m.point, m.daily_limit,
    m.active_from, m.active_until, m.verification_type
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

  -- daily_limit: 이 인증(NEW)의 제출일(KST)에 이미 부여된 같은 미션 점수 횟수
  IF v_mission.daily_limit IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_today_count
    FROM public.score_ledgers sl
    JOIN public.verifications v ON v.id = sl.verification_id
    WHERE v.mission_id = NEW.mission_id
      AND sl.user_id = NEW.user_id
      AND (v.submitted_at AT TIME ZONE 'Asia/Seoul')::date
        = (NEW.submitted_at AT TIME ZONE 'Asia/Seoul')::date;

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
    v_mission.program_id, NEW.user_id, NEW.id, v_mission.point, v_reason
  )
  ON CONFLICT (verification_id) DO NOTHING;

  RETURN NEW;
END;
$$;
