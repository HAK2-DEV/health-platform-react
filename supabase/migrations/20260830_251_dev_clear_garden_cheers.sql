-- ============================================================
-- Migration: 251 - 개발용 · 내가 보낸 응원 나비 지우기
-- 작성일: 2026-08-30
-- 설명:
--   /dev/growth 에서 응원 보내기를 «반복해서» 확인하려면 하루 한도를 되돌릴 수단이 필요하다.
--   250 의 RLS 는 SELECT 만 열려 있어 클라이언트가 직접 지울 수 없다.
--
--   ⚠️ 개발 편의용이다. 성장 탭을 참여자에게 노출하기 «전에» 반드시 지운다.
--      (rollbacks/251_revert_dev_clear_garden_cheers.sql 실행)
--
--   안전 범위 —
--     · 지우는 대상은 «호출자가 보낸» 것뿐이다(from_user_id = auth.uid()).
--     · 이미 «닿은»(landed_at IS NOT NULL) 것은 건드리지 않는다.
--       닿은 응원은 양쪽 성장 포인트에 이미 반영돼 있어서, 지우면 점수가 조용히 줄어든다.
--     · 남의 응원·남의 점수에는 어떤 경우에도 영향이 없다.
--
-- 하위호환: 새 함수 1개 추가. 호출하는 코드가 없으면 아무 일도 안 일어난다.
--
-- 복구:
--   supabase/rollbacks/251_revert_dev_clear_garden_cheers.sql 수동 실행.
-- ============================================================

CREATE OR REPLACE FUNCTION public.dev_clear_my_garden_cheers(p_program_id UUID)
RETURNS INT                       -- 지운 개수
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me  UUID := auth.uid();
  v_cnt INT;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  DELETE FROM public.garden_cheers
  WHERE program_id = p_program_id
    AND from_user_id = v_me
    AND landed_at IS NULL;        -- 닿은 건 점수에 반영됐으므로 손대지 않는다

  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RETURN v_cnt;
END;
$$;

REVOKE ALL ON FUNCTION public.dev_clear_my_garden_cheers(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dev_clear_my_garden_cheers(UUID) TO authenticated;

COMMENT ON FUNCTION public.dev_clear_my_garden_cheers(UUID) IS
  '개발용 — /dev/growth 반복 테스트를 위해 «내가 보낸, 아직 안 닿은» 응원을 지운다. 출시 전 제거할 것.';
