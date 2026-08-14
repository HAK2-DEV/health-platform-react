-- ============================================================
-- Migration: 209 - increment_food_pick() — 식품 선택 횟수 +1 (인기순)
-- 작성일: 2026-08-14
-- 설명:
--   식단 로거에서 음식을 담을 때 호출 → foods.pick_count +1. search_foods 가 이 값으로 정렬(인기순).
--   SECURITY DEFINER 로 클라(anon/authenticated)가 직접 쓰기 없이 카운트만 증가.
--
-- 복구: drop function public.increment_food_pick(text);
-- ============================================================

create or replace function public.increment_food_pick(p_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.foods set pick_count = pick_count + 1 where id = p_id;
$$;

grant execute on function public.increment_food_pick(text) to anon, authenticated;
