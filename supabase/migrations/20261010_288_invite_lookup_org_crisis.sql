-- ============================================================
-- Migration: 288 - 초대 코드 조회(lookup_invite_program)에 운영 기관·109 안내 칸 추가
-- 작성일: 2026-10-10
-- 설명:
--   초대 링크 페이지(JoinByCodePage)는 프로그램을 RPC 로만 읽는다(비공개 프로그램이라 직접 SELECT 불가).
--   287 에서 생긴 org_name(운영 기관)·crisis_line_enabled(마음 건강 109 안내)를 반환 JSON 에 더한다.
--   그 밖의 키·검사·권한은 123 과 똑같다(키 2개만 추가 — 기존 클라이언트는 모르는 키를 무시한다).
-- 하위호환: CREATE OR REPLACE(시그니처 동일). 이 마이그만 먼저 올라가도 기존 코드는 그대로 돈다.
-- 권한: 123 과 같이 authenticated 에만 EXECUTE(270 의 정리 기준 유지 — 로그인 전 화면은 부르지 않는다).
-- 복구: supabase/rollbacks/288_revert_invite_lookup_org_crisis.sql (123 의 본문으로 되돌림)
-- ============================================================

CREATE OR REPLACE FUNCTION public.lookup_invite_program(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program public.programs%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_program FROM public.programs WHERE invite_code = TRIM(p_code) LIMIT 1;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code'); END IF;
  IF v_program.status IS DISTINCT FROM 'PUBLISHED' THEN RETURN jsonb_build_object('ok', false, 'reason', 'program_not_published'); END IF;
  IF v_program.join_type IS DISTINCT FROM 'INVITE_CODE' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_invite_program'); END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'program', jsonb_build_object(
      'id', v_program.id,
      'name', v_program.name,
      'description', v_program.description,
      'start_date', v_program.start_date,
      'end_date', v_program.end_date,
      'categories', v_program.categories,
      'cover_image_path', v_program.cover_image_path,
      'max_participants', v_program.max_participants,
      'owner_id', v_program.owner_id,
      'join_type', v_program.join_type,
      'invite_requires_approval', v_program.invite_requires_approval,
      'preview_enabled', v_program.preview_enabled,
      'entry_question', v_program.entry_question,
      'org_name', v_program.org_name,                        -- 288
      'crisis_line_enabled', v_program.crisis_line_enabled   -- 288
    )
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.lookup_invite_program(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_invite_program(TEXT) TO authenticated;
