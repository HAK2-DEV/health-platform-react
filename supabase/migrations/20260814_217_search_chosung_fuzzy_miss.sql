-- ============================================================
-- Migration: 217 - 초성 검색 + 오타 보정(fuzzy) + 검색 실패 로깅
-- 작성일: 2026-08-14
-- 설명:
--   1) 초성 검색: to_chosung(name) 생성열 + btree 인덱스 → "ㄷㄱㅅㅅ"→닭가슴살.
--   2) 오타 보정: search_foods deep 에 pg_trgm 유사도(%) arm 추가 → "닭가슴사"→닭가슴살.
--   3) 실패 로깅: search_misses 테이블 + log_search_miss RPC → 0건 검색어 수집(동의어 사전 보강용).
--   search_foods v3 = 앞일치(항상) ∪ 초성일치(초성쿼리) ∪ 부분일치(deep) ∪ 유사도(deep).
--
-- 하위호환: 컬럼/함수/테이블 추가 + search_foods CREATE OR REPLACE(반환·시그니처 동일). 호출부 무변경.
--   ⚠️ chosung 생성열 백필로 적용에 1~수분, 그동안 foods 잠깐 잠길 수 있음(읽기전용이라 안전).
-- 복구: drop column foods.chosung; drop function to_chosung, log_search_miss; drop table search_misses;
--       search_foods 는 216 본문으로 재정의.
-- ============================================================

-- 1) 초성 추출 (한글 음절 → 초성 문자열). IMMUTABLE 이라 생성열 사용 가능.
create or replace function public.to_chosung(p text)
returns text
language plpgsql
immutable
as $$
declare
  cho text[] := array['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  out text := '';
  i int;
  code int;
  c text;
begin
  if p is null then return ''; end if;
  for i in 1..char_length(p) loop
    c := substr(p, i, 1);
    code := ascii(c);
    if code >= 44032 and code <= 55203 then           -- 가(AC00)~힣(D7A3)
      out := out || cho[((code - 44032) / 588)::int + 1];
    elsif c ~ '[ㄱ-ㅎ]' then                            -- 이미 초성 자모
      out := out || c;
    end if;                                            -- 그 외(영문/숫자/공백) 스킵
  end loop;
  return out;
end $$;

alter table public.foods
  add column if not exists chosung text
  generated always as (public.to_chosung(name)) stored;

create index if not exists foods_chosung_prefix
  on public.foods (chosung text_pattern_ops);

-- 2) 검색 v3 — 초성 arm + 유사도(deep) arm 추가
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
    -- 오타 보정(유사도) — deep 일 때만, trgm % 연산자
    (select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat, f.pick_count
       from public.foods f, p
      where deep and not p.is_cho and char_length(p.qn) >= 3 and f.search_nospace % p.qn
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
grant execute on function public.to_chosung(text) to anon, authenticated;

-- 3) 검색 실패 로깅 — 0건 검색어 빈도 집계(동의어 사전 보강 소스)
create table if not exists public.search_misses (
  term    text primary key,
  cnt     int not null default 0,
  last_at timestamptz not null default now()
);
alter table public.search_misses enable row level security;
drop policy if exists search_misses_admin_read on public.search_misses;
create policy search_misses_admin_read on public.search_misses
  for select using (public.is_admin());   -- 관리자만 조회(집계 RPC 는 definer 로 기록)

create or replace function public.log_search_miss(p_term text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.search_misses(term, cnt)
  select left(lower(trim(p_term)), 80), 1
  where length(trim(coalesce(p_term, ''))) >= 2
  on conflict (term) do update
    set cnt = public.search_misses.cnt + 1, last_at = now();
$$;

grant execute on function public.log_search_miss(text) to anon, authenticated;
