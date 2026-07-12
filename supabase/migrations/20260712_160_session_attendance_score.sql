-- ============================================================
-- Migration: 160 - 클래스 출석 확정 → 포인트 적립 트리거
-- 작성일: 2026-07-12
-- 설명:
--   session_attendance.status='confirmed' 시 sessions.points 만큼 score_ledgers 적립.
--   기존 포인트 파이프라인(score_ledgers 합산)을 그대로 재사용 → 마이페이지·랭킹 자동 반영.
--   출석 취소/거절(confirmed→그 외) 시 해당 적립 회수.
--
--   score_ledgers.verification_id 는 nullable(UNIQUE) → 출석 원장은 verification_id NULL,
--   대신 session_id 로 세션-사용자 1건 보장(부분 유니크).
--
--   3가지 확정 방식 공통:
--     operator_roll : 운영자가 confirmed INSERT/UPDATE (RLS owner)
--     self_approve  : 참가자 pending → 운영자 confirmed UPDATE (RLS)
--     venue_code    : (후속) SECURITY DEFINER RPC 로 confirmed
--   → 어느 경로든 confirmed 되면 이 트리거가 포인트 부여.
--
-- 영향: score_ledgers 1컬럼 + 부분 유니크 인덱스 + 트리거. 기존 동작 불변.
--
-- 복구:
--   DROP TRIGGER IF EXISTS grant_score_after_attendance ON public.session_attendance;
--   DROP FUNCTION IF EXISTS public.grant_score_on_attendance();
--   DROP INDEX IF EXISTS public.score_ledgers_session_user_uniq;
--   ALTER TABLE public.score_ledgers DROP COLUMN IF EXISTS session_id;
-- ============================================================

ALTER TABLE public.score_ledgers
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE;

-- 세션-사용자 출석 원장 1건 보장(중복 적립 차단). verification_id 원장과 무관(부분).
CREATE UNIQUE INDEX IF NOT EXISTS score_ledgers_session_user_uniq
  ON public.score_ledgers (session_id, user_id) WHERE session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.grant_score_on_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prog UUID;
  v_pts  INT;
BEGIN
  IF NEW.status = 'confirmed' THEN
    SELECT s.program_id, s.points INTO v_prog, v_pts
    FROM public.sessions s WHERE s.id = NEW.session_id;

    IF v_pts IS NOT NULL AND v_pts > 0 THEN
      INSERT INTO public.score_ledgers (program_id, user_id, session_id, point, reason)
      VALUES (v_prog, NEW.user_id, NEW.session_id, v_pts, '클래스 출석')
      ON CONFLICT (session_id, user_id) WHERE session_id IS NOT NULL DO NOTHING;
    END IF;

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' AND NEW.status <> 'confirmed' THEN
    -- 출석 취소/거절 → 적립 회수
    DELETE FROM public.score_ledgers
    WHERE session_id = NEW.session_id AND user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grant_score_after_attendance ON public.session_attendance;
CREATE TRIGGER grant_score_after_attendance
  AFTER INSERT OR UPDATE OF status ON public.session_attendance
  FOR EACH ROW EXECUTE FUNCTION public.grant_score_on_attendance();
