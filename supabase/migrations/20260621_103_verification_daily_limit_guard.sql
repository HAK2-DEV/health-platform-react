-- Migration: 103 - verifications daily_limit 하드 차단 (서버측 강제)
--
-- 배경:
--   기존엔 daily_limit 가 020 score_ledgers 트리거(점수 부여 시점)에서만 검증됐다.
--   → verifications INSERT 자체는 막지 않아, 같은 미션을 하루에 여러 번 제출하면
--      레코드가 중복 생성됨 (2번째부터는 점수만 0). 클라이언트 재진입/뒤로가기/
--      다른 경로(기록하기 vs 프로그램 개별 진입)로 중복 제출 발생.
--
-- 해결:
--   BEFORE INSERT 트리거로 daily_limit 도달 시 INSERT 자체를 거부한다.
--   - daily_limit IS NULL  → 무제한 (검증 생략)
--   - KST 오늘 기준, 같은 (user, mission) 의 REJECTED 가 아닌 인증 수 >= daily_limit → 차단
--     (반려된 인증은 한도에 포함하지 않음 — 재제출 허용)
--
-- 멱등: CREATE OR REPLACE + DROP TRIGGER IF EXISTS. 기존 데이터 영향 없음(신규 INSERT 만 검증).

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

  -- 미션 없음 또는 무제한 → 통과
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.verifications v
  WHERE v.mission_id = NEW.mission_id
    AND v.user_id = NEW.user_id
    AND v.status <> 'REJECTED'
    AND (v.submitted_at AT TIME ZONE 'Asia/Seoul')::date
      = (NOW() AT TIME ZONE 'Asia/Seoul')::date;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'DAILY_LIMIT_REACHED'
      USING ERRCODE = 'P0001',
            HINT = 'daily_limit';
  END IF;

  RETURN NEW;
END;
$$;

-- 018 의 set_status_before_verification_insert 보다 뒤에 돌아도 무방
-- (status 는 한도 카운트에 'REJECTED 제외' 로만 쓰이고, 신규 INSERT 는 REJECTED 가 아니므로).
DROP TRIGGER IF EXISTS enforce_daily_limit_before_verification_insert ON public.verifications;
CREATE TRIGGER enforce_daily_limit_before_verification_insert
  BEFORE INSERT ON public.verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_verification_daily_limit();
