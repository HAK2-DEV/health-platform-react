-- ============================================================
-- Migration: 125 - get_pending_reviews 에 기록 지표(metric_values/metrics) 추가
-- 작성일: 2026-06-23
-- 설명:
--   운영자 인증 심사 화면에서 참여자가 입력한 기록 지표(거리/시간/칼로리 등)를 보여주기 위해
--   RPC 반환 시그니처에 v_metric_values(제출값 JSONB) + m_metrics(미션 지표 정의 JSONB) 추가.
--   052 시그니처 그대로 + 2개 컬럼만 확장.
--
--   하위호환: 기존 클라이언트는 컬럼을 이름으로 읽어 무관. 새 컬럼만 추가됨.
--
-- 복구:
--   052(20260526_052_pending_reviews_include_avatar.sql) 의 함수 본문으로 재생성.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_pending_reviews(UUID);

CREATE OR REPLACE FUNCTION public.get_pending_reviews(p_program_id UUID)
RETURNS TABLE (
  v_id            UUID,
  v_image_path    TEXT,
  v_numeric_value NUMERIC,
  v_metric_values JSONB,
  v_note          TEXT,
  v_submitted_at  TIMESTAMPTZ,
  m_id            UUID,
  m_title         TEXT,
  m_point         INT,
  m_metrics       JSONB,
  u_id            UUID,
  u_nickname      TEXT,
  u_avatar_path   TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id, v.image_path, v.numeric_value, v.metric_values, v.note, v.submitted_at,
    m.id, m.title, m.point, m.metrics,
    u.id, u.nickname, u.avatar_path
  FROM public.verifications v
  JOIN public.missions m ON m.id = v.mission_id
  JOIN public.users u ON u.id = v.user_id
  WHERE m.program_id = p_program_id
    AND v.status = 'PENDING_REVIEW'
    AND m.program_id IN (
      SELECT id FROM public.programs WHERE owner_id = auth.uid()
    )
  ORDER BY v.submitted_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_reviews(UUID) TO authenticated;
