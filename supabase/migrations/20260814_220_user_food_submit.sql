-- ============================================================
-- Migration: 220 - 개별 음식 등록(내 음식) — 하이브리드 1a
-- 작성일: 2026-08-14
-- 설명:
--   임시 직접입력(저장·검색 안 됨)을 → 영구 등록으로. 사용자 음식을 foods 테이블에
--   함께 넣어 검색·초성·오타보정·즐겨찾기를 그대로 재사용.
--   · foods 에 source/submitted_by/is_public/verified 컬럼 추가(기존 행 source='gov').
--   · submit_food RPC — 제공량(g)+영양 → per-100g 변환 저장, source='user', 비공개(1a).
--   · search_foods 가시성 필터: gov ∪ 공개 ∪ 본인등록. 반환에 source/verified 추가(배지용).
--   공유(is_public)·검증(verified)·신고는 1b 에서 RPC 추가(스키마 변경 없음).
--
-- 하위호환: 컬럼은 default 라 즉시(테이블 재작성 X). search_foods CREATE OR REPLACE(반환에 컬럼 2개 추가).
--   ⚠️ 클라 searchFoods 매핑은 추가 컬럼 무시해도 동작 → 프로드 먼저 적용 후 클라 배포.
-- 복구: alter table foods drop column source, submitted_by, is_public, verified;
--       drop function submit_food; search_foods 를 219 본문으로 재정의.
-- ============================================================

alter table public.foods add column if not exists source       text    not null default 'gov';  -- gov | user
alter table public.foods add column if not exists submitted_by uuid;                             -- 등록자(gov=null)
alter table public.foods add column if not exists is_public    boolean not null default false;   -- 공유 여부(1b)
alter table public.foods add column if not exists verified     boolean not null default false;   -- 관리자 검증(1b)

create index if not exists foods_submitted_by on public.foods (submitted_by) where submitted_by is not null;

-- 등록 RPC — 제공량(g) 기준 입력 → per-100g 변환 저장. 등록 행을 그대로 반환.
create or replace function public.submit_food(
  p_name text, p_maker text, p_serving_g numeric,
  p_kcal numeric, p_carb numeric, p_protein numeric, p_fat numeric
)
returns table (
  id text, name text, maker text, serving text,
  kcal int, carb int, protein int, fat int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id text := 'u_' || replace(gen_random_uuid()::text, '-', '');
  g numeric := greatest(coalesce(p_serving_g, 100), 1);
  f numeric := 100.0 / g;                       -- per-100g 변환 계수
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'name required'; end if;
  return query
  insert into public.foods(
    id, name, maker, type_nm, serving, kcal, carb, protein, fat,
    source, submitted_by, is_public, verified)
  values (
    new_id, btrim(p_name), nullif(btrim(coalesce(p_maker, '')), ''), '음식', '100g',
    round(coalesce(p_kcal, 0) * f)::int, round(coalesce(p_carb, 0) * f)::int,
    round(coalesce(p_protein, 0) * f)::int, round(coalesce(p_fat, 0) * f)::int,
    'user', auth.uid(), false, false)
  returning foods.id, foods.name, foods.maker, foods.serving,
            foods.kcal, foods.carb, foods.protein, foods.fat;
end $$;

grant execute on function public.submit_food(text, text, numeric, numeric, numeric, numeric, numeric) to authenticated;

-- 검색 v4 — 가시성 필터(gov ∪ 공개 ∪ 본인) + 반환에 source/verified 추가
-- (반환 컬럼 추가라 CREATE OR REPLACE 불가 → DROP 후 재생성)
drop function if exists public.search_foods(text, int, boolean);
create or replace function public.search_foods(q text, lim int default 30, deep boolean default false)
returns table (
  id text, name text, maker text, serving text,
  kcal int, carb int, protein int, fat int,
  source text, verified boolean
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
    (select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat, f.source, f.verified, f.pick_count
       from public.foods f, p
      where f.search_nospace like p.qn || '%'
        and (f.source = 'gov' or f.is_public or f.submitted_by = auth.uid())
      order by f.pick_count desc
      limit 120)
    union
    -- 초성일치
    (select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat, f.source, f.verified, f.pick_count
       from public.foods f, p
      where p.is_cho and f.chosung like p.qn || '%'
        and (f.source = 'gov' or f.is_public or f.submitted_by = auth.uid())
      order by f.pick_count desc
      limit 120)
    union
    -- 부분일치 — deep
    (select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat, f.source, f.verified, f.pick_count
       from public.foods f, p
      where deep and not p.is_cho and f.search_nospace ilike '%' || p.qn || '%'
        and (f.source = 'gov' or f.is_public or f.submitted_by = auth.uid())
      limit 300)
    union
    -- 오타 보정 — deep, 이름 기준 유사도
    (select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat, f.source, f.verified, f.pick_count
       from public.foods f, p
      where deep and not p.is_cho and char_length(p.qn) >= 3
        and replace(f.name, ' ', '') % p.qn
        and (f.source = 'gov' or f.is_public or f.submitted_by = auth.uid())
      limit 100)
  )
  select h.id, h.name, h.maker, h.serving, h.kcal, h.carb, h.protein, h.fat, h.source, h.verified
  from hits h, p
  order by
    (replace(h.name, ' ', '') = p.qn) desc,
    (replace(h.name, ' ', '') like p.qn || '%') desc,
    h.pick_count desc,
    char_length(h.name) asc
  limit greatest(1, least(coalesce(lim, 30), 60));
$$;

grant execute on function public.search_foods(text, int, boolean) to anon, authenticated;
