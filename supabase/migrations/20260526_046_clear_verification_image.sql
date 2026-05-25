-- ============================================================
-- Migration: 046 - clear_my_verification_image RPC 함수
-- 작성일: 2026-05-26
-- 설명: 피드에서 storage 백엔드 파일이 없는 고아 verification 의 image_path 만 NULL 처리.
--   기존 RLS (018 "owners can update") 는 운영자만 UPDATE 허용 → 참여자가 피드 봐도
--   자기 권한으로 image_path 정리 불가 → 매번 같은 404 에러 반복.
--
-- 이 함수는 SECURITY DEFINER 로:
--   - 호출자가 (a) 인증 작성자 본인 OR (b) 프로그램 운영자 일 때만 동작
--   - image_path 컬럼만 NULL 로 — 다른 필드 (status/numeric_value/note/score) 영향 X
--
-- 클라이언트 사용:
--   supabase.rpc('clear_my_verification_image', { p_verification_id: v.id })
--
-- 복구:
--   supabase/rollbacks/046_revert_clear_verification_image.sql 수동 실행.
-- ============================================================

CREATE OR REPLACE FUNCTION public.clear_my_verification_image(p_verification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
  v_authorized BOOLEAN;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN false;
  END IF;

  -- 본인 인증이거나 그 프로그램 운영자인지 검증
  SELECT EXISTS (
    SELECT 1
    FROM public.verifications v
    JOIN public.missions m ON m.id = v.mission_id
    JOIN public.programs p ON p.id = m.program_id
    WHERE v.id = p_verification_id
      AND (v.user_id = v_caller OR p.owner_id = v_caller)
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RETURN false;
  END IF;

  UPDATE public.verifications
  SET image_path = NULL
  WHERE id = p_verification_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_my_verification_image(UUID) TO authenticated;
