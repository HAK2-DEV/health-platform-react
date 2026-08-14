-- ============================================================
-- Migration: 219 - 오타 보정 안정화 (SET 임계값 제거 → 기본 0.3)
-- 작성일: 2026-08-14
-- 설명:
--   218 의 SET pg_trgm.similarity_threshold(0.2)는 (a) 너무 느슨해 흔한 글자
--   정밀검색이 8초+ & 노이즈, (b) 이 롤에 SET 권한 없음(42501).
--   → 함수 SET 절 제거, 기본 임계값 0.3 사용. 이름 기준 유사도(0.43 등)라 한 음절
--     빠진 오타("닭가슴사"→닭가슴살)는 여전히 잡히고, 후보가 줄어 속도·정밀도↑.
--   (더 공격적 오타교정은 추후 자모 분해 방식으로 — threshold 싸움 대신.)
--   함수 본문은 218 과 동일, SET 임계값 줄만 제거.
--
-- 하위호환: search_foods CREATE OR REPLACE(시그니처·반환 동일). 호출부 무변경.
-- 복구: 없음(이 정의가 안정본).
-- ============================================================

create or replace function public.search_foods(q text, lim int default 30, deep boolean default false)
returns table (
  id text, name text, maker text, serving text,
  kcal int, carb int, protein int, fat int
)
language sql
stable
set statement_timeout to '15s'
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
    -- 오타 보정(유사도) — deep 일 때만, 이름(공백제거)에 trgm % (기본 임계값 0.3)
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
