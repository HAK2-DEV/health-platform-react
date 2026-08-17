-- ============================================================
-- Migration: 230 - 사용자 성별/연령대(선택) 수집
-- 작성일: 2026-08-17
-- 설명:
--   추후 HP2030 성과 리포트의 형평성 분해(성별·연령대)용으로 지금부터 수집 시작.
--   리포트는 나중에 만들어도, 가입 시점부터 쌓아둬야 이력이 남으므로 선행 수집.
--   users 에 gender/age_range 추가(둘 다 nullable = 선택·비공개 허용).
--   쓰기는 기존 users 본인행 UPDATE 정책으로 처리(닉네임 저장과 동일 경로).
--
-- 값: gender 'M'|'F'|null(비공개), age_range '10s'|'20s'|'30s'|'40s'|'50s'|'60s'|'70s'|null
-- 하위호환: 컬럼 추가(IF NOT EXISTS, nullable). 기존 코드/데이터 영향 없음.
-- 복구: alter table public.users drop column gender, drop column age_range;
-- ============================================================

alter table public.users add column if not exists gender text;       -- 'M' | 'F' | null(비공개)
alter table public.users add column if not exists age_range text;    -- '10s'~'70s' | null
