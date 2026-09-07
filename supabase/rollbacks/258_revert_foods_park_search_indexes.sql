-- 258 되돌리기 — foods 검색 인덱스 재생성.
--
-- 🔴 식단(음식 검색) 기능을 켜기 «전에» 반드시 이 파일을 먼저 실행할 것.
--    인덱스 없이 search_foods 를 돌리면 321,469행 순차 스캔 + 유사도 계산이라
--    검색이 매우 느려지거나 statement_timeout(15s)에 걸린다.
--
-- ⚠️ 약 137MB 를 다시 먹는다. 실행 «전에» 여유를 확인할 것:
--      select pg_size_pretty(pg_database_size(current_database()));
--    GIN 빌드는 작업 공간도 추가로 쓴다. 무료 500MB 한도에선 최소 200MB 여유를 두자.
--    (227 에서 여유 없이 재작성하다 디스크 부족 53100 을 맞은 적이 있다.)
--
-- ⚠️ 32만 행 GIN 빌드는 수 분 걸린다. 한산한 시간에, 아래 순서대로.
--    실제로 쓰는 것부터 만들면 중간에 멈춰도 검색이 동작한다.
--    (원래 정의: 214 / 218 / 214 / 211 / 217 / 207)

-- 1) 실제 일꾼 — 이 둘만 있어도 검색은 제대로 동작한다
create index if not exists foods_search_nospace_trgm
  on public.foods using gin (search_nospace gin_trgm_ops);            -- 214

create index if not exists foods_name_nospace_trgm
  on public.foods using gin (replace(name, ' ', '') gin_trgm_ops);    -- 218 유사도(%) arm

-- 2) 보조 — 여유가 있으면
create index if not exists foods_pick_idx
  on public.foods (pick_count desc);                                  -- 207

create index if not exists foods_chosung_prefix
  on public.foods (chosung text_pattern_ops);                         -- 217

-- 3) 플래너가 안 쓰던 것들 — 굳이 되살릴 필요 없다(258 주석 참고).
--    되살리려면 아래 주석을 풀 것.
-- create index if not exists foods_search_nospace_prefix
--   on public.foods (search_nospace text_pattern_ops);                -- 214
-- create index if not exists foods_name_prefix_idx
--   on public.foods (name text_pattern_ops);                          -- 211
