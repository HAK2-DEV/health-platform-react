-- ============================================================
-- Migration: 047 - clear_my_verification_image 권한 확장 (피드 피어 포함)
-- 작성일: 2026-05-26
-- 설명: 046 은 (작성자 본인 OR 운영자) 만 허용 → 참여자 A 가 참여자 B 의 깨진 사진을 만나도
--   둘 다 아니라 RPC false 반환 → 매번 같은 깨진 path 반복 노출.
--   원래 storage RLS (038) 가 ACTIVE 피드 피어에게 SELECT 허용하니, 같은 권한 범위 안에서
--   image_path 정리도 허용하는 게 일관적.
--
-- 새 조건:
--   (a) 인증 작성자 본인  OR
--   (b) 프로그램 운영자  OR
--   (c) 같은 프로그램의 ACTIVE 참여자 (feed_enabled=true)
--
-- 영향: 다른 필드는 그대로, image_path 컬럼만 NULL. 깨진 사진 cleanup 전용.
--
-- 복구:
--   supabase/rollbacks/047_revert_clear_verification_image_peer.sql 수동 실행 → 046 시점 본문 복원.
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

  -- 작성자 본인 / 운영자 / 같은 feed_enabled 프로그램의 ACTIVE 참여자
  SELECT EXISTS (
    SELECT 1
    FROM public.verifications v
    JOIN public.missions m ON m.id = v.mission_id
    JOIN public.programs p ON p.id = m.program_id
    LEFT JOIN public.program_participants pp
      ON pp.program_id = p.id AND pp.user_id = v_caller
    WHERE v.id = p_verification_id
      AND (
        v.user_id = v_caller
        OR p.owner_id = v_caller
        OR (pp.status = 'ACTIVE' AND p.feed_enabled = true)
      )
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
