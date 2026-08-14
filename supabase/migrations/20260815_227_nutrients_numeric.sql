-- ============================================================
-- Migration: 227 - 영양소 numeric 전환 (테이블 재작성 없이) + 디스크 여유 확보
-- 작성일: 2026-08-15
-- 설명:
--   ALTER COLUMN TYPE 는 32만행 foods 를 통째로 재작성 → 디스크 부족(53100).
--   대신 재작성이 없는 방식으로:
--     1) 미사용 원본 trgm 인덱스 foods_search_trgm(search_text 기반) 드롭
--        → 현재 검색은 search_nospace 사용(214~)이라 이 인덱스는 불필요. 드롭 시 디스크 즉시 회수.
--     2) int 컬럼 4종 DROP + numeric(7,2) 재ADD (둘 다 카탈로그 연산, 재작성 없음).
--        음식(epIndex 0) 재적재분 int 값은 사라지지만 이후 전체 재적재로 소수 채움.
--   cholesterol·sodium(mg) 은 int 유지.
--
-- 하위호환: 검색 기능 영향 없음(search_nospace 인덱스로 동작). 컬럼 재생성이라 클라 무변경.
-- 복구: 인덱스 재생성 create index foods_search_trgm ...; 컬럼은 226/227 참고.
-- ============================================================

-- 1) 공간 회수 — 미사용 원본 검색 인덱스 드롭(즉시 디스크 반환)
drop index if exists public.foods_search_trgm;

-- 2) 그램 영양소 4종: int → numeric(7,2) (DROP + ADD, 재작성 없음)
alter table public.foods drop column if exists sugar;
alter table public.foods drop column if exists sat_fat;
alter table public.foods drop column if exists trans_fat;
alter table public.foods drop column if exists fiber;

alter table public.foods add column if not exists sugar     numeric(7,2);   -- 당류(g)
alter table public.foods add column if not exists sat_fat   numeric(7,2);   -- 포화지방(g)
alter table public.foods add column if not exists trans_fat numeric(7,2);   -- 트랜스지방(g)
alter table public.foods add column if not exists fiber     numeric(7,2);   -- 식이섬유(g)
