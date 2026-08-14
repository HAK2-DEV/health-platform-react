-- ============================================================
-- Migration: 207 - foods 테이블 (식품영양성분 적재) + 부분일치 검색
-- 작성일: 2026-08-14
-- 설명:
--   정부 통합식품영양성분(음식·가공식품·원재료성, 약 61만건)을 우리 DB에 적재해
--   ① 부분일치 검색(우유→저지방우유 등), ② 제조사(브랜드) 검색(하림→하림 제품),
--   ③ 인기순(pick_count) 정렬 을 가능하게 한다. (정부 API 는 foodNm prefix + 인기없음)
--   적재는 엣지함수 food-ingest 가 service role 로 upsert. 검색은 pg_trgm(ilike '%q%').
--
-- 하위호환/영향: 새 테이블·확장·인덱스만 추가. 기존 기능 무영향.
-- 복구:
--   drop table if exists public.foods;  drop extension 은 남겨도 무방.
-- ============================================================

create extension if not exists pg_trgm;

create table if not exists public.foods (
  id          text primary key,          -- foodCd (데이터셋 간 고유)
  name        text not null,             -- foodNm (제품유형: 초코파이, 닭가슴살…)
  maker       text,                      -- mfrNm 제조사(브랜드). '해당없음'→null
  type_nm     text,                      -- 음식 / 가공식품 / 원재료
  serving     text,                      -- nutConSrtrQua 기준량(보통 100g)
  food_size   text,                      -- foodSize 총중량(1회분 환산용, 후속)
  kcal        int,
  carb        int,
  protein     int,
  fat         int,
  sodium      int,
  pick_count  int not null default 0,    -- 인기순(선택 횟수) — step3
  updated_at  timestamptz not null default now(),
  -- 부분일치 검색용 — 이름 + 제조사 결합(자동 유지)
  search_text text generated always as (name || ' ' || coalesce(maker, '')) stored
);

-- 부분일치(ilike '%q%') 가속 — 한글 트라이그램 GIN
create index if not exists foods_search_trgm on public.foods using gin (search_text gin_trgm_ops);
-- 인기순 정렬
create index if not exists foods_pick_idx on public.foods (pick_count desc);

-- RLS: 공개 영양데이터 → 모두 읽기 허용. 쓰기(적재)는 정책 없음 = service role(엣지함수)만.
alter table public.foods enable row level security;
drop policy if exists foods_public_read on public.foods;
create policy foods_public_read on public.foods for select to anon, authenticated using (true);
