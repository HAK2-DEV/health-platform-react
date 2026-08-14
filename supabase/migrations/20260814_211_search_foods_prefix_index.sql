-- ============================================================
-- Migration: 211 - search_foods() 속도 2차 개선 (앞일치 btree + 타임아웃 상향)
-- 작성일: 2026-08-14
-- 설명:
--   210 이후에도 "초코파이/우유"처럼 부분일치 행이 많은 검색이 콜드 캐시에서
--   ~3초 걸려 statement timeout(57014)로 500이 남.
--   원인: trgm GIN 은 `ilike '%q%'` 에서 LIMIT 으로 조기 종료가 안 됨(비트맵 전체 생성).
--
--   대응 2가지:
--   (1) 앞일치용 btree 인덱스(name text_pattern_ops) 추가 →
--       `name like q||'%'` 가 콜드에서도 즉시(우유·닭가슴살 등 앞일치 케이스 즉답).
--       앞일치 arm 을 LIKE(대소문자 구분)로 바꿔 이 인덱스를 타게 함(한글은 영향 없음).
--   (2) 함수에 `set statement_timeout` 상향 → 광범위 부분일치도 에러 대신 완료(콜드 1회만 느림, 이후 캐시로 빨라짐).
--
--   부분일치(저지방'우유', 제조사 '하림' 등)는 그대로 trgm GIN 사용(캡 300).
--
-- 하위호환: 시그니처·반환형 동일. 인덱스 추가 + 함수 교체(additive). 클라 변경 불필요.
-- 복구: drop index foods_name_prefix_idx; 그리고 210 함수 본문으로 재적용.
-- ============================================================

-- (1) 앞일치 전용 btree — LIKE 'q%' 가속 (콜드에서도 빠름)
create index if not exists foods_name_prefix_idx
  on public.foods (name text_pattern_ops);

-- (2) 함수: 앞일치(btree) ∪ 부분일치(trgm, 캡) + 타임아웃 상향
create or replace function public.search_foods(q text, lim int default 30)
returns table (
  id text, name text, maker text, serving text,
  kcal int, carb int, protein int, fat int
)
language sql
stable
set statement_timeout to '15s'
as $$
  with hits as (
    -- 앞일치(이름 앞부분 = 정확·prefix) — btree 인덱스, 콜드에서도 즉시
    (select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat, f.pick_count
       from public.foods f
      where f.name like q || '%'
      order by f.pick_count desc
      limit 60)
    union
    -- 부분일치·제조사 보강 — trgm GIN, 캡 300
    (select f.id, f.name, f.maker, f.serving, f.kcal, f.carb, f.protein, f.fat, f.pick_count
       from public.foods f
      where f.search_text ilike '%' || q || '%'
      limit 300)
  )
  select h.id, h.name, h.maker, h.serving, h.kcal, h.carb, h.protein, h.fat
  from hits h
  order by
    (h.name = q) desc,                 -- 정확 일치 먼저
    (h.name like q || '%') desc,       -- 앞부분 일치 다음
    h.pick_count desc,                 -- 인기순
    char_length(h.name) asc            -- 짧은(일반적) 이름 우선
  limit greatest(1, least(coalesce(lim, 30), 50));
$$;

grant execute on function public.search_foods(text, int) to anon, authenticated;
