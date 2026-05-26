-- ============================================================
-- Migration: 052 - get_pending_reviews 에 u_avatar_path 추가
-- 작성일: 2026-05-26
-- 설명: 운영자 심사 화면에 인증자 아바타를 함께 보여주기 위해 RPC 반환 시그니처 확장.
--   030 시점 시그니처에 u_avatar_path TEXT 컬럼만 추가.
--
-- 복구:
--   supabase/rollbacks/052_revert_pending_reviews_include_avatar.sql 수동 실행.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_pending_reviews(UUID);

CREATE OR REPLACE FUNCTION public.get_pending_reviews(p_program_id UUID)
RETURNS TABLE (
  v_id            UUID,
  v_image_path    TEXT,
  v_numeric_value NUMERIC,
  v_note          TEXT,
  v_submitted_at  TIMESTAMPTZ,
  m_id            UUID,
  m_title         TEXT,
  m_point         INT,
  u_id            UUID,
  u_nickname      TEXT,
  u_avatar_path   TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id, v.image_path, v.numeric_value, v.note, v.submitted_at,
    m.id, m.title, m.point,
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
