-- ============================================================
-- Migration: 086 - 운영자의 참여자 내보내기(탈퇴)
-- 작성일: 2026-06-16
-- 설명:
--   운영자가 참여자 통계(유저 상세)에서 특정 참여자를 프로그램에서 내보낼 수 있게 함.
--   - status 에 'LEFT' 값 추가 (CHECK 확장) + left_at 컬럼 추가
--   - remove_participant_from_program RPC: 프로그램 owner 만 호출 가능.
--     해당 참여자 status='LEFT' 처리 → ranking(get_program_ranking 는 status='ACTIVE'
--     만 집계)·활성 카운트에서 자동 제외 + 인증 INSERT RLS(ACTIVE 참여자) 차단.
--   - 기록(verifications/score_ledgers)은 보존 (감사·이력). 필요 시 운영자가 재참여로 복구 가능.
--
-- 하위호환: status CHECK 는 값을 넓히기만(기존 값 유지), left_at 은 ADD IF NOT EXISTS,
--   함수는 신규 → 기존 코드 영향 없음.
--
-- 복구: status='LEFT' 행을 'ACTIVE' 로 UPDATE. 함수는 DROP FUNCTION 으로 제거.
-- ============================================================

-- 1) status 'LEFT' 허용 + left_at
ALTER TABLE public.program_participants
  DROP CONSTRAINT IF EXISTS program_participants_status_check;
ALTER TABLE public.program_participants
  ADD CONSTRAINT program_participants_status_check
  CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'COMPLETED', 'LEFT'));

ALTER TABLE public.program_participants
  ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;

-- 2) 운영자 전용 내보내기 RPC
CREATE OR REPLACE FUNCTION public.remove_participant_from_program(
  p_program_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT owner_id INTO v_owner FROM public.programs WHERE id = p_program_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION '프로그램을 찾을 수 없습니다';
  END IF;
  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION '프로그램 운영자만 참여자를 내보낼 수 있습니다';
  END IF;
  IF p_user_id = v_owner THEN
    RAISE EXCEPTION '운영자 본인은 내보낼 수 없습니다';
  END IF;

  UPDATE public.program_participants
     SET status = 'LEFT', left_at = now()
   WHERE program_id = p_program_id AND user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_participant_from_program(UUID, UUID) TO authenticated;
