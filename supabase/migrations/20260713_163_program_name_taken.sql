-- ============================================================
-- Migration: 163 - 프로그램 이름 중복 검사 RPC (전역)
-- 작성일: 2026-07-13
-- 설명:
--   프로그램 생성 1단계에서 이름 중복을 「전체 운영자 기준」으로 검사.
--   참가자는 남의 비공개 프로그램을 SELECT 못 하므로, SECURITY DEFINER 로
--   존재 여부(boolean)만 반환(이름/소유자 등 정보는 노출 안 함).
--
--   중복으로 보는 대상:
--     - 다른 운영자의 「공개(PUBLISHED)」 + 종료 안 된 프로그램
--     - 내 프로그램(상태 무관) + 종료 안 됨   (내 초안끼리도 중복 방지)
--   종료 판정: end_date 가 KST 오늘보다 과거면 종료(무관). end_date NULL 이면 진행.
--   p_exclude_id: 편집 중인 프로그램 자신 제외.
--
-- 영향: 신규 함수 1개. 기존 동작 불변.
--
-- 복구: DROP FUNCTION IF EXISTS public.program_name_taken(TEXT, UUID);
-- ============================================================

CREATE OR REPLACE FUNCTION public.program_name_taken(p_name TEXT, p_exclude_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.programs p
    WHERE btrim(COALESCE(p_name, '')) <> ''
      AND lower(btrim(p.name)) = lower(btrim(p_name))
      AND p.id IS DISTINCT FROM p_exclude_id
      AND (p.end_date IS NULL OR p.end_date >= (now() AT TIME ZONE 'Asia/Seoul')::date)
      AND (p.status = 'PUBLISHED' OR p.owner_id = auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.program_name_taken(TEXT, UUID) TO authenticated;
