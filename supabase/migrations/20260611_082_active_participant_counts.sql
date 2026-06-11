-- ============================================================
-- Migration: 082 - 정확한 ACTIVE 참여자 수 집계 RPC
-- 작성일: 2026-06-11
-- 설명: program_participants 직접 COUNT 는 RLS(015) 때문에 "본인 참여 + 본인 소유
--   프로그램"만 보여, 다른 운영자 프로그램의 참여자 수가 0~1 로 잘못 나옴.
--   참여자 "수"는 민감정보가 아니므로 SECURITY DEFINER 로 RLS 우회해 정확 집계.
--   여러 프로그램을 한 번에(N+1 제거).
--
-- 반환: 참여자 1명 이상인 program_id 만 (0명은 결과에 없음 → 클라에서 0 보정).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_active_participant_counts(p_program_ids UUID[])
RETURNS TABLE (program_id UUID, participant_count INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pp.program_id, COUNT(*)::int AS participant_count
  FROM public.program_participants pp
  WHERE pp.program_id = ANY(p_program_ids)
    AND pp.status = 'ACTIVE'
  GROUP BY pp.program_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_participant_counts(UUID[]) TO authenticated;
