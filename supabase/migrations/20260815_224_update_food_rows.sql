-- ============================================================
-- Migration: 224 - update_food 가 수정된 행 수 반환 (진단·피드백)
-- 작성일: 2026-08-15
-- 설명:
--   "수정했는데 값이 안 바뀜" 원인 특정용. update_food 를 void → int(row_count) 로 변경해
--   클라가 0(대상 못 찾음) vs 1(정상) 을 구분/표시하게 함. 본문 로직 동일.
--   반환형 변경 → DROP 후 재생성.
--
-- 하위호환: 클라 updateFood 는 반환값을 숫자로 해석(마이그223 시절 !error 였음 → 224와 함께 배포).
-- 복구: 223 본문(returns void)로 재정의.
-- ============================================================

drop function if exists public.update_food(text, text, text, numeric, numeric, numeric, numeric, numeric);

create or replace function public.update_food(
  p_food_id text, p_name text, p_maker text, p_serving_g numeric,
  p_kcal numeric, p_carb numeric, p_protein numeric, p_fat numeric
)
returns int
language plpgsql security definer set search_path = public as $$
declare
  g numeric := greatest(coalesce(p_serving_g, 100), 1);
  f numeric := 100.0 / g;
  n int;
begin
  if coalesce(btrim(p_name), '') = '' then raise exception 'name required'; end if;
  update public.foods set
    name = btrim(p_name),
    maker = nullif(btrim(coalesce(p_maker, '')), ''),
    kcal = round(coalesce(p_kcal, 0) * f)::int,
    carb = round(coalesce(p_carb, 0) * f)::int,
    protein = round(coalesce(p_protein, 0) * f)::int,
    fat = round(coalesce(p_fat, 0) * f)::int,
    verified = false,
    updated_at = now()
  where id = p_food_id and source = 'user' and submitted_by = auth.uid();
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function public.update_food(text, text, text, numeric, numeric, numeric, numeric, numeric) to authenticated;
