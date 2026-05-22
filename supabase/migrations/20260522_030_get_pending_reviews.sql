-- ============================================================
-- Migration: 030 - get_pending_reviews RPC (운영자 심사 목록)
-- 작성일: 2026-05-22
-- 설명: 운영자가 자기 프로그램의 PENDING_REVIEW 인증을 조회.
--       024 의 get_program_ranking 패턴 일치 — SECURITY DEFINER 로
--       users 테이블 (다른 참여자의 nickname) 안전하게 JOIN.
--
-- 반환 컬럼:
--   v_id            verification id (승인/반려 시 PK)
--   v_image_path    Storage 경로 (createSignedUrl 로 임시 URL)
--   v_numeric_value 숫자 인증 값
--   v_note          소감 텍스트
--   v_submitted_at  제출 시각
--   m_id            mission id
--   m_title         미션 제목
--   m_point         부여 예정 점수
--   u_id            참여자 user id
--   u_nickname      참여자 닉네임
--
-- 권한: WHERE m.program_id IN (SELECT id FROM programs WHERE owner_id = auth.uid())
--   → 본인이 운영자가 아닌 프로그램의 PENDING 은 안 보임 (자체 권한 검사)
-- ============================================================

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
  u_nickname      TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id, v.image_path, v.numeric_value, v.note, v.submitted_at,
    m.id, m.title, m.point,
    u.id, u.nickname
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
