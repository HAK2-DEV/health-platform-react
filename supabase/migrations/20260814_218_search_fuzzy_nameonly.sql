-- ============================================================
-- Migration: 218 - 오타 보정 정확도 개선 (이름 기준 유사도 + 임계값 완화)
-- 작성일: 2026-08-14
-- 설명:
--   217 의 오타 보정은 search_nospace(이름+제조사)에 유사도(%)를 걸어,
--   제조사 글자가 유사도를 희석 → "닭가슴사"가 "닭가슴살"을 못 찾음.
--   해결: 유사도를 이름만(공백제거)에 적용 + 임계값 0.3→0.2 완화(한글 한 음절 오타 대응).
--   이름 공백제거 표현식 trgm 인덱스 추가.
--
-- 하위호환: 인덱스 추가 + search_foods CREATE OR REPLACE(시그니처·반환 동일). 호출부 무변경.
--   ⚠️ 표현식 trgm 인덱스 빌드로 수십초~수분(읽기전용이라 안전).
-- 복구: drop index foods_name_nospace_trgm; search_foods 를 217 본문으로 재정의.
-- ============================================================

create index if not exists foods_name_nospace_trgm
  on public.foods using gin (replace(name, ' ', '') gin_trgm_ops);

create or replace function public.search_foods(q text, lim int default 30, deep boolean default false)
returns table (
  id text, name text, maker text, serving text,
  kcal int, carb int, protein int, fat int
)
language sql
stable
set statement_timeout to '15s'
set pg_trgm.similarity_threshold to '0.2'   -- 한글 한 음절 오타까지 잡히게 완화(deep 전용 arm)
as $$
  with p as (
    select replace(coalesce(q, ''), ' ', '') as qn,
           (replace(coalesce(q, ''), ' ', '') ~ '^[ㄱ-ㅎ]+$') as is_cho
  )
  , hits as (
    -- 앞일치(공백무시) — 항상, btree, 즉시
    (select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat, f.pick_count
       from public.foods f, p
      where f.search_nospace like p.qn || '%'
      order by f.pick_count desc
      limit 120)
    union
    -- 초성일치 — 초성으로만 친 경우, btree, 즉시
    (select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat, f.pick_count
       from public.foods f, p
      where p.is_cho and f.chosung like p.qn || '%'
      order by f.pick_count desc
      limit 120)
    union
    -- 부분일치(공백무시) — deep 일 때만, trgm
    (select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat, f.pick_count
       from public.foods f, p
      where deep and not p.is_cho and f.search_nospace ilike '%' || p.qn || '%'
      limit 300)
    union
    -- 오타 보정(유사도) — deep 일 때만, 이름(공백제거)에 trgm % (제조사 희석 제거)
    (select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat, f.pick_count
       from public.foods f, p
      where deep and not p.is_cho and char_length(p.qn) >= 3
        and replace(f.name, ' ', '') % p.qn
      limit 100)
  )
  select h.id, h.name, h.maker, h.serving, h.kcal, h.carb, h.protein, h.fat
  from hits h, p
  order by
    (replace(h.name, ' ', '') = p.qn) desc,
    (replace(h.name, ' ', '') like p.qn || '%') desc,
    h.pick_count desc,
    char_length(h.name) asc
  limit greatest(1, least(coalesce(lim, 30), 60));
$$;

grant execute on function public.search_foods(text, int, boolean) to anon, authenticated;
