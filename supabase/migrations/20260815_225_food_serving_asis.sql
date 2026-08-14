-- ============================================================
-- Migration: 225 - 등록 음식을 "입력한 제공량 그대로" 저장 (per-100g 강제 제거)
-- 작성일: 2026-08-15
-- 설명:
--   제품마다 1회 제공량이 다름(30g, 45g, 200ml…). 기존엔 submit/update 가 per-100g 로
--   변환해 serving='100g' 로 고정 → "100g당" 강제 표시. 불필요한 제약.
--   foods.serving 텍스트에서 기준량을 파싱해 그램 환산하는 파이프라인(foodBasis)이 이미 있으므로,
--   변환 없이 serving='<입력 g>g' + 그 제공량 기준 영양치를 그대로 저장하면 자연스럽게 표시·스케일됨.
--   (정부 음식도 '100ml당' 등 제각각으로 이미 이렇게 동작.)
--   submit_food / update_food 본문만 변경 (시그니처·반환형 동일).
--
-- 하위호환: 기존 per-100g 저장 행은 serving='100g' 그대로 유지(정상 동작). 신규·수정분만 실제 제공량.
-- 복구: 223/224 본문(per-100g 변환)으로 재정의.
-- ============================================================

create or replace function public.submit_food(
  p_name text, p_maker text, p_serving_g numeric,
  p_kcal numeric, p_carb numeric, p_protein numeric, p_fat numeric
)
returns table (
  id text, name text, maker text, serving text,
  kcal int, carb int, protein int, fat int
)
language plpgsql security definer set search_path = public as $$
declare
  new_id text := 'u_' || replace(gen_random_uuid()::text, '-', '');
  g numeric := greatest(coalesce(p_serving_g, 100), 1);
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'name required'; end if;
  return query
  insert into public.foods(
    id, name, maker, type_nm, serving, kcal, carb, protein, fat,
    source, submitted_by, is_public, verified)
  values (
    new_id, btrim(p_name), nullif(btrim(coalesce(p_maker, '')), ''), '음식',
    round(g)::text || 'g',                                   -- 입력 제공량 그대로
    round(coalesce(p_kcal, 0))::int, round(coalesce(p_carb, 0))::int,
    round(coalesce(p_protein, 0))::int, round(coalesce(p_fat, 0))::int,
    'user', auth.uid(), false, false)
  returning foods.id, foods.name, foods.maker, foods.serving,
            foods.kcal, foods.carb, foods.protein, foods.fat;
end $$;
grant execute on function public.submit_food(text, text, numeric, numeric, numeric, numeric, numeric) to authenticated;

create or replace function public.update_food(
  p_food_id text, p_name text, p_maker text, p_serving_g numeric,
  p_kcal numeric, p_carb numeric, p_protein numeric, p_fat numeric
)
returns int
language plpgsql security definer set search_path = public as $$
declare
  g numeric := greatest(coalesce(p_serving_g, 100), 1);
  n int;
begin
  if coalesce(btrim(p_name), '') = '' then raise exception 'name required'; end if;
  update public.foods set
    name = btrim(p_name),
    maker = nullif(btrim(coalesce(p_maker, '')), ''),
    serving = round(g)::text || 'g',                         -- 입력 제공량 그대로
    kcal = round(coalesce(p_kcal, 0))::int,
    carb = round(coalesce(p_carb, 0))::int,
    protein = round(coalesce(p_protein, 0))::int,
    fat = round(coalesce(p_fat, 0))::int,
    verified = false,
    updated_at = now()
  where id = p_food_id and source = 'user' and submitted_by = auth.uid();
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.update_food(text, text, text, numeric, numeric, numeric, numeric, numeric) to authenticated;
