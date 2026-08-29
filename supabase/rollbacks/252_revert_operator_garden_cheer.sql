-- 252 되돌리기 — 운영자 응원 나비 제거
-- ⚠️ is_operator 컬럼을 지우면 «누가 운영자로 보냈는지» 기록이 사라진다.
--    기능만 끄려면 컬럼은 두고 함수만 250 버전으로 되돌리는 편이 낫다.

DROP FUNCTION IF EXISTS public.get_my_cheer_quota(UUID);

-- send_garden_cheer · get_my_garden_cheers 는
-- supabase/migrations/20260830_250_garden_cheers.sql 의 정의를 다시 실행해 되돌린다.
DROP FUNCTION IF EXISTS public.get_my_garden_cheers(UUID);

-- 기록까지 지우려면:
-- ALTER TABLE public.garden_cheers DROP COLUMN IF EXISTS is_operator;
