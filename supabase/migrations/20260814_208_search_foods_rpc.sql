-- ============================================================
-- Migration: 208 - search_foods() 검색 RPC (부분일치 + 제조사 + 인기순)
-- 작성일: 2026-08-14
-- 설명:
--   foods(207) 부분일치 검색. search_text(이름+제조사) ilike '%q%' → trgm GIN 인덱스 사용.
--   정렬: 정확일치 → prefix(앞일치) → 인기순(pick_count) → 짧은이름 순.
--   → "우유" 치면 저지방우유 등 다, "하림" 치면 제조사가 하림인 제품 다, 자주 담는 게 위로.
--
-- 하위호환: 새 함수만. anon/authenticated 실행 허용(공개 영양데이터).
-- 복구: drop function public.search_foods(text,int);
-- ============================================================

create or replace function public.search_foods(q text, lim int default 30)
returns table (
  id text, name text, maker text, serving text,
  kcal int, carb int, protein int, fat int
)
language sql
stable
as $$
  select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat
  from public.foods f
  where f.search_text ilike '%' || q || '%'
  order by
    (f.name = q) desc,                 -- 정확 일치 먼저
    (f.name ilike q || '%') desc,      -- 앞부분 일치 다음
    f.pick_count desc,                 -- 인기순(선택 많은 순)
    char_length(f.name) asc            -- 짧은(일반적인) 이름 우선
  limit greatest(1, least(coalesce(lim, 30), 50))
$$;

grant execute on function public.search_foods(text, int) to anon, authenticated;
