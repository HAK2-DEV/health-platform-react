-- ============================================================
-- Migration: 223 - 내 등록 음식 관리 (조회·수정·삭제)
-- 작성일: 2026-08-15
-- 설명:
--   등록만 되고 관리 수단이 없던 문제 해결. 등록자 본인만.
--   · get_my_foods  — 내가 등록한 음식 목록
--   · update_food   — 제공량(g)+영양 수정(per-100g 변환). 수정 시 verified 해제(라벨과 달라질 수 있음)
--   · delete_food   — 내 음식 삭제 (food_reports FK on delete cascade)
--
-- 하위호환: 신규 함수만. 기존 무변경. (foods 스냅샷을 참조하는 user_foods/verifications 는 FK 없음 → 안전)
-- 복구: drop function get_my_foods, update_food, delete_food;
-- ============================================================

create or replace function public.get_my_foods()
returns table (
  id text, name text, maker text, serving text,
  kcal int, carb int, protein int, fat int,
  is_public boolean, verified boolean
)
language sql stable security definer set search_path = public as $$
  select id, name, maker, serving, kcal, carb, protein, fat, is_public, verified
  from public.foods
  where source = 'user' and submitted_by = auth.uid()
  order by updated_at desc
  limit 200;
$$;
grant execute on function public.get_my_foods() to authenticated;

create or replace function public.update_food(
  p_food_id text, p_name text, p_maker text, p_serving_g numeric,
  p_kcal numeric, p_carb numeric, p_protein numeric, p_fat numeric
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  g numeric := greatest(coalesce(p_serving_g, 100), 1);
  f numeric := 100.0 / g;
begin
  if coalesce(btrim(p_name), '') = '' then raise exception 'name required'; end if;
  update public.foods set
    name = btrim(p_name),
    maker = nullif(btrim(coalesce(p_maker, '')), ''),
    kcal = round(coalesce(p_kcal, 0) * f)::int,
    carb = round(coalesce(p_carb, 0) * f)::int,
    protein = round(coalesce(p_protein, 0) * f)::int,
    fat = round(coalesce(p_fat, 0) * f)::int,
    verified = false,               -- 수정하면 라벨 검증 해제
    updated_at = now()
  where id = p_food_id and source = 'user' and submitted_by = auth.uid();
end $$;
grant execute on function public.update_food(text, text, text, numeric, numeric, numeric, numeric, numeric) to authenticated;

create or replace function public.delete_food(p_food_id text)
returns void
language sql security definer set search_path = public as $$
  delete from public.foods
  where id = p_food_id and source = 'user' and submitted_by = auth.uid();
$$;
grant execute on function public.delete_food(text) to authenticated;
