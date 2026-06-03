-- ============================================================
-- Migration: 073 - 회원 탈퇴 RPC (delete_my_account)
-- 작성일: 2026-06-03
-- 설명:
--   본인이 회원 탈퇴 시 호출하는 SECURITY DEFINER RPC.
--   auth.users 행 DELETE → public.users 의 FK CASCADE 로 모든 관련 데이터(participants/
--   verifications/scores/notifications/posts/comments/likes/rank_snapshots 등) 자동 삭제.
--
-- 보안:
--   - SECURITY DEFINER + auth.uid() 검증으로 본인 행만 삭제 가능.
--   - search_path 명시로 SQL injection 방어.
--   - 함수 OWNER 는 postgres — auth schema 접근 가능.
--
-- 흐름:
--   1) 프론트가 본인 닉네임 재입력 확인 모달 통과 후 호출
--   2) RPC 가 auth.users DELETE
--   3) Supabase 가 자동 signOut → /login 으로 이동
--
-- 복구:
--   supabase/rollbacks/073_revert_delete_my_account.sql 수동 실행.
--   ※ 이미 삭제된 사용자 데이터는 복구 불가 — 함수만 제거.
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '인증되지 않은 사용자';
  END IF;

  -- auth.users DELETE → public.users.id REFERENCES auth.users(id) ON DELETE CASCADE
  -- → 그 외 모든 FK CASCADE 자동 적용 (participants / verifications / scores / 등)
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
