-- ============================================================
-- Migration: 002 - users Triggers
-- 작성일: 2026-05-19
-- 설명: public.users 의 Trigger 2개
--
-- Trigger 1: 회원가입 시 public.users 자동 INSERT
--   auth.users 에 INSERT 발생 시 같은 id 로 public.users 행 자동 생성.
--   SECURITY DEFINER 로 RLS 우회 (회원가입 시점에는 일반 권한 X).
--
-- Trigger 2: 닉네임 변경 시 7일 제한
--   nickname 컬럼 UPDATE 시 마지막 변경으로부터 7일 경과 점검.
--   NULL → 값 변경 (첫 설정) 은 허용.
-- ============================================================

-- Trigger 1: 회원가입 시 자동 INSERT
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

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Trigger 2: 닉네임 변경 7일 제한
CREATE OR REPLACE FUNCTION public.check_nickname_change_interval()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.nickname IS DISTINCT FROM OLD.nickname THEN
    -- NULL 에서 처음 설정 = 허용 (회원가입 후 첫 닉네임)
    IF OLD.nickname IS NULL THEN
      NEW.nickname_changed_at = NOW();
      RETURN NEW;
    END IF;
    
    -- 7일 이내 변경 시도 = 거부
    IF OLD.nickname_changed_at IS NOT NULL 
       AND OLD.nickname_changed_at > NOW() - INTERVAL '7 days' THEN
      RAISE EXCEPTION '닉네임은 1주일에 한 번만 변경할 수 있습니다. 다음 변경 가능: %', 
        OLD.nickname_changed_at + INTERVAL '7 days';
    END IF;
    
    -- 변경 허용 + 시간 자동 기록
    NEW.nickname_changed_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_nickname_change_before_update
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.check_nickname_change_interval();