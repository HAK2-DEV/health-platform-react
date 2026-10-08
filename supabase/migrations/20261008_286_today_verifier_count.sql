-- ============================================================
-- Migration: 286 - 「오늘 할 일」 오늘 인증한 사람 수 (집계 함수)
-- 작성일: 2026-10-08
-- 설명:
--   프로그램 홈 「오늘 할 일」 맨 아래 「오늘 N명이 인증했어요」. 참여자는 남의 인증 중 «승인 + 피드 공개»만 읽을 수 있어서(266)
--   화면에서 세면 심사 대기·비공개 인증이 빠져 실제보다 적게 나온다(운영자 심사 미션이 많을수록 차이가 크다).
--   → 숫자 하나만 돌려주는 집계 함수. 누가 했는지는 주지 않는다.
--   · 부를 수 있는 사람: 그 프로그램의 운영자 또는 참여 중인 사람. 그 밖·로그인 안 함 → NULL.
--   · 셈: 오늘(KST) 제출된 인증 중 심사 대기·승인인 것의 «사람 수». 만회 인증은 제출 시각이 원래 날이라(283) 그날에 들어간다.
--   · 오늘 범위는 시각 범위로 비교한다 → 인증 색인(mission_id, submitted_at)을 탄다(070).
--
--   하위호환: 새 함수 하나. 화면은 함수가 없으면(적용 전) 그 줄만 숨긴다 → 마이그·화면 배포 순서와 무관.
--   권한: PUBLIC·anon 실행 회수, authenticated 만. REVOKE FROM PUBLIC 만으로는 anon 이 안 막힌다
--     [[feedback_revoke_from_public_footgun]] — 적용 뒤 익명 키로 불러 막혔는지 확인할 것.
--
-- 복구: supabase/rollbacks/286_revert_today_verifier_count.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_program_today_verifier_count(p_program_id UUID)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_start TIMESTAMPTZ := ((now() AT TIME ZONE 'Asia/Seoul')::date)::timestamp AT TIME ZONE 'Asia/Seoul';   -- 오늘 0시(KST)
  v_n     INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.programs p WHERE p.id = p_program_id AND p.owner_id = v_uid)
     AND NOT public._is_active_participant(p_program_id, v_uid) THEN
    RETURN NULL;
  END IF;

  SELECT count(DISTINCT v.user_id)::int INTO v_n
  FROM public.verifications v
  JOIN public.missions m ON m.id = v.mission_id
  WHERE m.program_id = p_program_id
    AND v.status IN ('PENDING_REVIEW', 'APPROVED')
    AND v.submitted_at >= v_start
    AND v.submitted_at <  v_start + interval '1 day';

  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.get_program_today_verifier_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_program_today_verifier_count(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_program_today_verifier_count(UUID) TO authenticated;
