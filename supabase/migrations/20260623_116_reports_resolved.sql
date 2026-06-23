-- ============================================================
-- Migration: 116 - 신고 처리 상태(resolved) + 처리 RPC
-- 작성일: 2026-06-23
-- 설명:
--   신고(reports)에 처리 여부 컬럼을 추가해, 운영자가 처리한 신고를 미처리와 구분.
--   운영자 메뉴 「신고 관리」 배지는 '미처리 신고가 있는 콘텐츠 수'만 카운트한다.
--     · resolved=false (기본) → 미처리. 가리기/복구/처리완료 시 그 콘텐츠의 신고를 true 로.
--     · 새 신고가 또 들어오면 그 행은 resolved=false → 콘텐츠가 다시 '미처리'로 잡힘.
--
--   처리는 SECURITY DEFINER RPC(resolve_reports)로만 — 운영자(owner) 검증 후 해당
--   콘텐츠의 미처리 신고를 일괄 처리. (reports 에 광범위한 UPDATE 정책을 열지 않기 위함)
--
--   하위호환: 기존 행은 resolved=false(미처리)로 시작 → 운영자가 한 번 정리하면 됨.
--
-- 복구:
--   DROP FUNCTION IF EXISTS public.resolve_reports(UUID, TEXT, UUID);
--   ALTER TABLE public.reports DROP COLUMN IF EXISTS resolved, DROP COLUMN IF EXISTS resolved_at;
-- ============================================================

-- 1) 컬럼 추가 (하위호환 — 기본 false)
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- 미처리 신고 조회용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_reports_unresolved ON public.reports(program_id) WHERE resolved = false;

-- 2) 처리 RPC — 운영자 검증 후 해당 콘텐츠의 미처리 신고 일괄 처리
CREATE OR REPLACE FUNCTION public.resolve_reports(
  p_program_id UUID,
  p_target_type TEXT,
  p_target_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.programs p WHERE p.id = p_program_id AND p.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION '권한이 없어요';
  END IF;

  UPDATE public.reports
  SET resolved = true, resolved_at = now()
  WHERE program_id = p_program_id
    AND target_type = p_target_type
    AND target_id = p_target_id
    AND resolved = false;
END;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_reports(UUID, TEXT, UUID) TO authenticated;
