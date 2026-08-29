-- 250 되돌리기 — 성장 탭 응원 나비 제거
-- ⚠️ garden_cheers 를 지우면 응원 기록과 그로 얻은 점수가 사라진다(성장 포인트가 줄어든다).
--    기록을 남기고 기능만 끄려면 테이블은 두고 트리거·함수만 지운 뒤,
--    249 의 get_program_garden(응원 미반영 버전)을 다시 적용하면 된다.

DROP TRIGGER IF EXISTS land_garden_cheers_after_verification ON public.verifications;
DROP FUNCTION IF EXISTS public.land_garden_cheers_on_approval();
DROP FUNCTION IF EXISTS public.send_garden_cheer(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_my_garden_cheers(UUID);

-- get_program_garden 은 249 버전으로 되돌린다(pending_cheers 컬럼과 응원 점수 합산 제거).
--   supabase/migrations/20260829_249_get_program_garden.sql 의 함수 정의를 다시 실행할 것.
DROP FUNCTION IF EXISTS public.get_program_garden(UUID);

-- 기록까지 지우려면:
-- DROP TABLE IF EXISTS public.garden_cheers;
