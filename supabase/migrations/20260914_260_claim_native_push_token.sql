-- ============================================================
-- Migration: 260 - 네이티브 푸시 토큰 소유권 이전 RPC
-- 작성일: 2026-09-14
-- 설명:
--   native_push_tokens.token 은 UNIQUE 이고 RLS 는 "user_id = auth.uid()" 단일 정책(259).
--   그래서 «같은 기기(같은 FCM 토큰)를 다른 계정이 이어받는» 경우
--   클라이언트의 upsert(onConflict:'token') 가 기존 행(user_id=타인)을 UPDATE 하려다
--   RLS USING 검사에 걸려 «new row violates row-level security policy» 로 «항상 실패»한다.
--   → 계정 전환 후 새 사용자는 푸시를 영영 못 켜고, 이전 사용자의 알림이 이 기기로 계속 간다.
--
--   FCM 등록 토큰은 «앱 설치 단위»라 계정이 바뀌어도 동일하므로, 소유권 이전은 정상 흐름이다.
--   클라이언트 권한으로는 타인 행을 지울 수 없으니 SECURITY DEFINER 함수로 서버에서 처리한다.
--   (탈취 위험 없음: 토큰을 제시할 수 있는 쪽이 곧 그 기기이고, 이전 소유자는 어차피
--    그 기기에서 로그아웃했거나 재설치한 상태다. 발송은 service role 이 담당.)
--
-- 복구:
--   DROP FUNCTION IF EXISTS public.claim_native_push_token(text, text);
--   (클라이언트는 다시 upsert 경로로 돌아가며, 같은 계정 재등록은 그대로 동작)
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_native_push_token(
  p_token    text,
  p_platform text DEFAULT 'android'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;
  IF p_token IS NULL OR length(btrim(p_token)) < 20 THEN
    RAISE EXCEPTION '유효하지 않은 푸시 토큰입니다';
  END IF;

  -- 같은 기기(token)가 다른 계정에 묶여 있으면 그 행을 제거 → 소유권 이전
  DELETE FROM public.native_push_tokens
   WHERE token = p_token AND user_id <> v_uid;

  INSERT INTO public.native_push_tokens (user_id, token, platform)
  VALUES (v_uid, p_token, COALESCE(NULLIF(btrim(p_platform), ''), 'android'))
  ON CONFLICT (token) DO UPDATE
    SET user_id    = EXCLUDED.user_id,
        platform   = EXCLUDED.platform,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.claim_native_push_token(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_native_push_token(text, text) TO authenticated;
