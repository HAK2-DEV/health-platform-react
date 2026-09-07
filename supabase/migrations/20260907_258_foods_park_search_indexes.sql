-- ============================================================
-- Migration: 258 - foods 검색 인덱스 «파킹» (디스크 약 137MB 즉시 회수)
-- 작성일: 2026-09-07
-- 설명:
--   DB 가 304MB/500MB(61%)까지 찼고 그중 foods 가 253MB(92%)를 차지했다.
--   운영 데이터는 다 합쳐도 10MB 미만인데 «아직 쓰지 않는» 정적 참조 테이블이
--   자리를 다 먹고 있는 구조였다.
--
--   식단 기능 프로덕션 미사용 확인(2026-09-07):
--     meal_type 설정 미션 0 · DIET 프로그램 0 · 식단 인증 0
--     pick_count > 0 인 음식 0 / 321,469  ← 한 번도 담긴 적 없음
--     (인덱스 스캔 298회는 개발 중 테스트분)
--
--   → 데이터(321,469행)는 «그대로 두고» 파생 구조인 인덱스만 내린다.
--     데이터가 비싼 부분이고, 인덱스는 몇 분이면 다시 만든다.
--
--   드롭 대상 (2026-09-07 pg_stat_user_indexes 실측):
--     foods_search_nospace_trgm    45 MB   GIN trgm — 부분일치/deep arm
--     foods_name_nospace_trgm      36 MB   GIN trgm — 유사도(%) arm
--     foods_search_nospace_prefix  24 MB   btree    — 플래너가 애초에 안 씀(스캔 0)
--     foods_name_prefix_idx        16 MB   btree    — 219 가 name 앞일치 arm 제거로 고아
--     foods_chosung_prefix         14 MB   btree    — 초성 arm(스캔 0)
--     foods_pick_idx              2.4 MB   btree    — 담긴 횟수 정렬(전부 0이라 무의미)
--   유지: foods_pkey(13MB, 제약·업서트에 필요) · foods_submitted_by(16kB, 사용자 제출분)
--
--   ⚠️⚠️ 식단 기능을 켜기 «전에» 반드시 롤백 파일로 인덱스를 먼저 재생성할 것.
--        인덱스 없이 search_foods 를 돌리면 321,469행 순차 스캔 + 유사도 계산이라
--        검색이 매우 느려지거나 statement_timeout(15s)에 걸린다.
--        재생성은 supabase/rollbacks/258_revert_foods_park_search_indexes.sql
--
--   ⚠️ VACUUM FULL / 테이블 재작성은 하지 않는다.
--      227 에서 foods 재작성이 디스크 부족(53100)으로 실패한 이력이 있다(2배 공간 필요).
--      DROP INDEX 는 재작성 없이 즉시 디스크를 반환한다 — 227 과 같은 방식.
--      같은 이유로 죽은 생성열 search_text(214 이후 미사용)도 남겨둔다:
--      DROP COLUMN 은 카탈로그 연산이라 어차피 공간이 회수되지 않는다.
--
-- 기대 효과: foods 253MB → 약 116MB, DB 61% → 약 33%.
--   70% 알림선까지 여유 45MB → 약 183MB (92일 운영분을 크게 상회).
--   덤으로 인덱스 재생성 시 필요한 디스크 여유도 확보된다(227 실패 재발 방지).
--
-- 하위호환: 인덱스만 제거. 함수·컬럼·데이터 무변경. 클라이언트 무관.
-- 복구: supabase/rollbacks/258_revert_foods_park_search_indexes.sql
-- ============================================================

drop index if exists public.foods_search_nospace_trgm;
drop index if exists public.foods_name_nospace_trgm;
drop index if exists public.foods_search_nospace_prefix;
drop index if exists public.foods_name_prefix_idx;
drop index if exists public.foods_chosung_prefix;
drop index if exists public.foods_pick_idx;

-- 확인 — 남은 인덱스 / foods 크기 / DB 크기
select indexrelname as index_name,
       pg_size_pretty(pg_relation_size(indexrelid)) as size
from pg_stat_user_indexes
where relname = 'foods'
order by pg_relation_size(indexrelid) desc;

select pg_size_pretty(pg_total_relation_size('public.foods')) as foods_total,
       pg_size_pretty(pg_database_size(current_database()))   as db_total;
