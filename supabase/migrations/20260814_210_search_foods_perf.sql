-- ============================================================
-- Migration: 210 - search_foods() 성능 개선 (후보 상한 + 앞일치 병합)
-- 작성일: 2026-08-14
-- 설명:
--   208의 search_foods 는 "닭가슴살"처럼 부분일치 행이 수천 개인 광범위 검색에서
--   매칭 전체를 정렬(order by)하느라 최대 2초까지 느렸음.
--   → 후보를 상한(prefix 60 + substring 300)으로 잘라 정렬 비용을 상수화.
--     · 앞일치(=이름 앞부분, 정확/prefix 포함)를 별도로 먼저 뽑아 항상 상위 노출 보장
--     · 부분일치는 300개까지만 스캔(trgm 인덱스가 조기 종료 → 빠름)
--   두 서브쿼리 모두 search_text 의 trgm GIN 인덱스(207) 사용.
--   search_text = name || ' ' || maker 라 `search_text ilike q||'%'` 는 사실상 이름 앞일치.
--
-- 하위호환: 시그니처·반환형 동일(search_foods(text,int)). CREATE OR REPLACE.
--   결과 순서만 더 빨라지고 좋아짐(랭킹 규칙 동일). 클라 변경 불필요.
-- 복구: 208 파일 내용으로 CREATE OR REPLACE 재적용.
-- ============================================================

create or replace function public.search_foods(q text, lim int default 30)
returns table (
  id text, name text, maker text, serving text,
  kcal int, carb int, protein int, fat int
)
language sql
stable
as $$
  with hits as (
    -- 앞일치(이름 앞부분 = 정확·prefix 포함) — 적고 정확, 항상 확보
    (select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat, f.pick_count
       from public.foods f
      where f.search_text ilike q || '%'
      order by f.pick_count desc
      limit 60)
    union
    -- 부분일치 보강 — 상한 300으로 정렬 비용 차단(인덱스 조기 종료)
    (select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat, f.pick_count
       from public.foods f
      where f.search_text ilike '%' || q || '%'
      limit 300)
  )
  select h.id, h.name, h.maker, h.serving, h.kcal, h.carb, h.protein, h.fat
  from hits h
  order by
    (h.name = q) desc,                 -- 정확 일치 먼저
    (h.name ilike q || '%') desc,      -- 앞부분 일치 다음
    h.pick_count desc,                 -- 인기순
    char_length(h.name) asc            -- 짧은(일반적) 이름 우선
  limit greatest(1, least(coalesce(lim, 30), 50));
$$;

grant execute on function public.search_foods(text, int) to anon, authenticated;
