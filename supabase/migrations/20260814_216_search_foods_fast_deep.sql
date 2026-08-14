-- ============================================================
-- Migration: 216 - 검색 2단계화 (빠른 앞일치 기본 + deep 정밀검색)
-- 작성일: 2026-08-14
-- 설명:
--   문제: 2글자 검색("햇반","우유")은 부분일치(%..%)가 trgm(3글자) 인덱스를 못 써
--         32만 행 seq-scan → 3~10초. 결과가 잘려 "햇반 2개"처럼 보이던 근본 원인.
--   해결: search_foods 를 2단계로.
--     · deep=false(기본, 타이핑마다) = 앞일치(btree)만 → 글자수 무관 즉시.
--     · deep=true(더보기/정밀)       = 앞일치 ∪ 부분일치(trgm) → 정확·느림(사용자 대기).
--   시그니처에 deep 추가. 기존 2-인자 버전은 DROP 하고 3-인자(기본값 포함)로 통일해 오버로드 모호성 제거.
--   (기존 클라 rpc('search_foods',{q,lim}) 호출은 deep 기본 false 로 그대로 동작 — 더 빨라짐.)
--
-- 하위호환: 호출부 무변경 동작(파라미터 기본값). 반환 컬럼/랭킹 동일.
-- 복구: drop function search_foods(text,int,boolean); 215 이전 정의(214 본문, 2-인자) 재생성.
-- ============================================================

drop function if exists public.search_foods(text, int);

create or replace function public.search_foods(q text, lim int default 30, deep boolean default false)
returns table (
  id text, name text, maker text, serving text,
  kcal int, carb int, protein int, fat int
)
language sql
stable
set statement_timeout to '15s'
as $$
  with p as (select replace(coalesce(q, ''), ' ', '') as qn)
  , hits as (
    -- 앞일치(공백무시) — 항상, btree, 글자수 무관 즉시
    (select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat, f.pick_count
       from public.foods f, p
      where f.search_nospace like p.qn || '%'
      order by f.pick_count desc
      limit 120)
    union
    -- 부분일치(공백무시) — deep 일 때만(느림), trgm
    (select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat, f.pick_count
       from public.foods f, p
      where deep and f.search_nospace ilike '%' || p.qn || '%'
      limit 300)
  )
  select h.id, h.name, h.maker, h.serving, h.kcal, h.carb, h.protein, h.fat
  from hits h, p
  order by
    (replace(h.name, ' ', '') = p.qn) desc,             -- 이름 정확일치(공백무시) 먼저
    (replace(h.name, ' ', '') like p.qn || '%') desc,   -- 이름 앞부분 일치 다음
    h.pick_count desc,                                  -- 인기순
    char_length(h.name) asc                             -- 짧은(일반적) 이름 우선
  limit greatest(1, least(coalesce(lim, 30), 60));
$$;

grant execute on function public.search_foods(text, int, boolean) to anon, authenticated;
