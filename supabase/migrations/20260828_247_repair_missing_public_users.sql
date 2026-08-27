-- ============================================================
-- Migration: 247 - public.users 누락 행 복구 + handle_new_user 안전망
-- 작성일: 2026-08-28
-- 설명:
--   auth.users 에는 있는데 public.users 행이 없는 "반쪽 계정" 4건이 발견됐다.
--   그 상태에서는 사용자에게 원인이 전혀 드러나지 않는 3가지 증상이 동시에 난다:
--     1) 닉네임·아바타 저장이 `UPDATE ... WHERE id=` 로 0행 → PostgREST 가 에러를 주지
--        않아(error null) 저장 실패인데도 다음 화면으로 넘어감
--     2) 마이페이지 프로필을 못 읽어 '?' 표시
--     3) 프로그램 참여 시 program_participants_user_id_fkey 위반
--        (program_participants.user_id → public.users(id))
--
--   발견된 4건은 모두 본인 테스트 계정이며 날짜가 개발 이력과 일치한다
--   (카카오 첫 테스트 2026-06-03 / 네이버 구현 2026-07-21 / 시딩 hp-seed-10 2026-07-26 /
--    카카오 2026-08-08). 실제 베타 사용자는 없다.
--   원인은 앱 버그가 아니라 과거 시딩 정리에서 public.users 만 지우고 auth.users 를
--   남긴 것으로 추정된다(반대 순서였다면 FK CASCADE 로 둘 다 정리됐다).
--   ※ 앞으로 테스트 계정 정리는 반드시 auth.users 를 지울 것 → CASCADE 로 함께 정리됨.
--
-- 이 마이그레이션이 하는 일:
--   (1) 누락된 public.users 행을 auth.users 기준으로 채운다. 특정 id 를 하드코딩하지 않고
--       LEFT JOIN 으로 찾으므로, 목록에 없던 계정이 더 있어도 함께 복구된다.
--       created_at 은 auth.users 의 가입시각을 그대로 살려 이력을 보존한다.
--   (2) handle_new_user 트리거에 ON CONFLICT (id) DO NOTHING 을 추가한다.
--       현재는 INSERT 만 하기 때문에 어떤 이유로든 충돌이 나면 예외 → AFTER INSERT 트리거
--       실패 → **auth.users INSERT 자체가 롤백** = 회원가입 실패로 이어진다.
--       행이 이미 있다면 조용히 넘어가는 편이 안전하다(가입을 막을 이유가 없다).
--
-- 하위호환:
--   기존 행은 건드리지 않는다(INSERT 만, 충돌 시 무시) — 닉네임·role·아바타 보존.
--   트리거는 동작이 넓어지기만 하므로 기존 코드와 무관하게 안전. 코드 변경 없이 단독 적용 가능.
--
-- 복구:
--   supabase/rollbacks/247_revert_repair_missing_public_users.sql 수동 실행.
--   ※ 복구로 채워진 행은 되돌리지 않는다(되돌리면 그 계정이 다시 깨진다). 트리거만 원복.
-- ============================================================

-- ─── (1) 누락된 public.users 행 채우기 ───────────────────────
INSERT INTO public.users (id, email, role, created_at)
SELECT
  au.id,
  au.email,
  'USER',
  au.created_at        -- 가입 시각 보존 (NOW() 로 덮으면 이력이 오늘로 뭉개진다)
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;


-- ─── (2) handle_new_user 안전망 ──────────────────────────────
-- 002 의 원본과 동일하되 ON CONFLICT (id) DO NOTHING 만 추가.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    'USER'
  )
  -- 이미 행이 있으면 조용히 넘어간다.
  --   여기서 예외가 나면 AFTER INSERT 트리거 실패 → auth.users INSERT 롤백 →
  --   회원가입 자체가 실패한다. 중복은 가입을 막을 사유가 아니다.
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
