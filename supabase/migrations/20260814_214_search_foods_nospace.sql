-- ============================================================
-- Migration: 214 - 띄어쓰기 무시 검색 (search_nospace)
-- 작성일: 2026-08-14
-- 설명:
--   "아이스아메리카노"↔"아이스 아메리카노", "닭가슴살"↔"닭 가슴살" 처럼
--   사용자의 띄어쓰기가 DB와 달라 검색이 안 되던 문제 해결.
--   공백 제거한 생성열 search_nospace 추가 + trgm/btree 인덱스 → 공백 무시 매칭.
--   search_foods 를 이 열로 검색하도록 교체(랭킹 규칙 동일, 시그니처 동일).
--
-- 하위호환: 컬럼 추가(생성열, additive) + 함수 CREATE OR REPLACE. 클라 변경 불필요.
--   ⚠️ 생성열 추가로 32만 행 백필 + 인덱스 빌드 → 적용에 1~2분 소요될 수 있음(읽기전용 테이블이라 안전).
-- 복구: drop function search_foods(text,int) 재정의(211 본문) + drop column search_nospace.
-- ============================================================

-- 공백 제거 검색열 (이름+제조사에서 모든 공백 제거)
alter table public.foods
  add column if not exists search_nospace text
  generated always as (replace(name || ' ' || coalesce(maker, ''), ' ', '')) stored;

create index if not exists foods_search_nospace_trgm
  on public.foods using gin (search_nospace gin_trgm_ops);
create index if not exists foods_search_nospace_prefix
  on public.foods (search_nospace text_pattern_ops);

-- 검색 RPC — 공백 제거 기준으로 매칭(앞일치 ∪ 부분일치, 상한)
create or replace function public.search_foods(q text, lim int default 30)
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
    -- 앞일치(공백무시) — btree, 콜드에서도 즉시
    (select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat, f.pick_count
       from public.foods f, p
      where f.search_nospace like p.qn || '%'
      order by f.pick_count desc
      limit 60)
    union
    -- 부분일치(공백무시) — trgm, 캡 300
    (select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat, f.pick_count
       from public.foods f, p
      where f.search_nospace ilike '%' || p.qn || '%'
      limit 300)
  )
  select h.id, h.name, h.maker, h.serving, h.kcal, h.carb, h.protein, h.fat
  from hits h, p
  order by
    (replace(h.name, ' ', '') = p.qn) desc,             -- 이름 정확일치(공백무시) 먼저
    (replace(h.name, ' ', '') like p.qn || '%') desc,   -- 이름 앞부분 일치 다음
    h.pick_count desc,                                  -- 인기순
    char_length(h.name) asc                             -- 짧은(일반적) 이름 우선
  limit greatest(1, least(coalesce(lim, 30), 50));
$$;

grant execute on function public.search_foods(text, int) to anon, authenticated;
