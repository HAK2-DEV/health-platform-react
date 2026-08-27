-- 247 복구 — handle_new_user 를 002 원본(ON CONFLICT 없음)으로 되돌린다.
--
-- ⚠️ 복구로 채워진 public.users 행은 **지우지 않는다**.
--    지우면 그 계정이 다시 반쪽 상태로 돌아가 프로필 저장·프로그램 참여가 막힌다.
--    (되돌릴 이유가 있다면 대상 id 를 직접 지정해 개별 삭제할 것)

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
  );
  RETURN NEW;
END;
$$;
