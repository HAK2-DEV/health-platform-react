-- ============================================================
-- Migration: 078 - 소감(인증 글) 수정 RPC
-- 작성일: 2026-06-11
-- 설명: 참여자가 자신의 인증 소감(verifications.note)을 수정할 수 있게 함.
--
-- 배경:
--   기존 RLS(018)는 점수 조작 방지를 위해 참여자의 verifications UPDATE 를 막아둠
--   (운영자만 UPDATE 가능). 따라서 RLS 를 푸는 대신, note 텍스트만 수정하는
--   전용 RPC 를 SECURITY DEFINER 로 제공한다.
--
-- 안전장치:
--   - 본인 행(user_id = auth.uid())만 수정 가능
--   - note 컬럼만 변경. status / point / image_path 등은 절대 건드리지 않음
--     → 점수(score_ledgers)는 status 에 묶여 있으므로 랭킹에 영향 없음
--   - 길이 300자 제한 (작성 폼과 동일)
--   - 소감 필수(requires_note) 미션은 빈 값으로 만들 수 없음
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_verification_note(
  p_verification_id UUID,
  p_note TEXT
)
RETURNS public.verifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.verifications;
  v_note TEXT;
  v_requires_note BOOLEAN;
BEGIN
  -- 공백 정리 — 빈 문자열은 NULL 로
  v_note := NULLIF(btrim(p_note), '');

  IF v_note IS NOT NULL AND char_length(v_note) > 300 THEN
    RAISE EXCEPTION '소감은 300자 이하여야 합니다';
  END IF;

  -- 대상 인증이 본인 것인지 + 소감 필수 미션인지 확인
  SELECT m.requires_note
  INTO v_requires_note
  FROM public.verifications ver
  JOIN public.missions m ON m.id = ver.mission_id
  WHERE ver.id = p_verification_id
    AND ver.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION '수정 권한이 없거나 인증을 찾을 수 없습니다';
  END IF;

  IF v_requires_note AND v_note IS NULL THEN
    RAISE EXCEPTION '소감은 비울 수 없습니다';
  END IF;

  UPDATE public.verifications
  SET note = v_note
  WHERE id = p_verification_id
    AND user_id = auth.uid()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_verification_note(UUID, TEXT) TO authenticated;
