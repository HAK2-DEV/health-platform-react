-- ============================================================
-- Migration: 215 - 내 음식(즐겨찾기·최근) user_foods
-- 작성일: 2026-08-14
-- 설명:
--   식단 로거에서 "자주 먹는 음식 즐겨찾기(♥)" + "최근에 담은 음식" 지원.
--   프로그램 무관 개인 전역 목록. 음식 스냅샷(per-100g 값 + basis)을 저장해
--   나중에 그램 조절까지 그대로 재현. 담을 때 use_count/last_used_at 갱신.
--   테이블 + RLS(본인 것만) + RPC 2종(touch_food 사용기록, set_food_favorite 하트토글).
--
-- 하위호환: 신규 테이블 + 신규 함수라 additive. 기존 코드 영향 없음.
--   클라(foodDb getUserFoods/recordUse/setFavorite)는 이 마이그 적용 후 동작.
-- 복구: drop table public.user_foods cascade; drop function touch_food, set_food_favorite.
-- ============================================================

create table if not exists public.user_foods (
  user_id      uuid not null references public.users(id) on delete cascade,
  food_id      text not null,                 -- foods.id (per100) 또는 안정 id
  name         text not null,
  maker        text,
  serving      text,
  kcal         int,
  carb         int,
  protein      int,
  fat          int,
  basis        text,                           -- 'per100' | null (그램 재현용)
  favorite     boolean not null default false,
  use_count    int not null default 0,
  last_used_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  primary key (user_id, food_id)
);

alter table public.user_foods enable row level security;

drop policy if exists user_foods_select on public.user_foods;
create policy user_foods_select on public.user_foods
  for select using (user_id = auth.uid());
drop policy if exists user_foods_insert on public.user_foods;
create policy user_foods_insert on public.user_foods
  for insert with check (user_id = auth.uid());
drop policy if exists user_foods_update on public.user_foods;
create policy user_foods_update on public.user_foods
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists user_foods_delete on public.user_foods;
create policy user_foods_delete on public.user_foods
  for delete using (user_id = auth.uid());

create index if not exists user_foods_recent
  on public.user_foods (user_id, last_used_at desc);
create index if not exists user_foods_fav
  on public.user_foods (user_id, favorite) where favorite;

-- 담을 때: 사용기록 upsert(횟수 +1, 최근시각 갱신, 스냅샷 최신화)
create or replace function public.touch_food(
  p_food_id text, p_name text,
  p_maker text default null, p_serving text default null,
  p_kcal int default null, p_carb int default null,
  p_protein int default null, p_fat int default null,
  p_basis text default null
) returns void
language sql security definer set search_path = public as $$
  insert into public.user_foods(
    user_id, food_id, name, maker, serving, kcal, carb, protein, fat, basis, use_count, last_used_at)
  values (auth.uid(), p_food_id, p_name, p_maker, p_serving, p_kcal, p_carb, p_protein, p_fat, p_basis, 1, now())
  on conflict (user_id, food_id) do update set
    use_count    = public.user_foods.use_count + 1,
    last_used_at = now(),
    name = excluded.name, maker = excluded.maker, serving = excluded.serving,
    kcal = excluded.kcal, carb = excluded.carb, protein = excluded.protein, fat = excluded.fat,
    basis = coalesce(excluded.basis, public.user_foods.basis);
$$;

-- 하트 토글: 없으면 스냅샷과 함께 생성, 있으면 favorite 만 갱신
create or replace function public.set_food_favorite(
  p_food_id text, p_on boolean, p_name text,
  p_maker text default null, p_serving text default null,
  p_kcal int default null, p_carb int default null,
  p_protein int default null, p_fat int default null,
  p_basis text default null
) returns void
language sql security definer set search_path = public as $$
  insert into public.user_foods(
    user_id, food_id, name, maker, serving, kcal, carb, protein, fat, basis, favorite)
  values (auth.uid(), p_food_id, p_name, p_maker, p_serving, p_kcal, p_carb, p_protein, p_fat, p_basis, p_on)
  on conflict (user_id, food_id) do update set favorite = p_on;
$$;

grant execute on function public.touch_food(text, text, text, text, int, int, int, int, text) to authenticated;
grant execute on function public.set_food_favorite(text, boolean, text, text, text, int, int, int, int, text) to authenticated;
