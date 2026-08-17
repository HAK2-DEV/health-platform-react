-- ============================================================
-- Migration: 231 - 프로그램 참여 설문(시작/종료)
-- 작성일: 2026-08-17
-- 설명:
--   운영자가 프로그램 시작/종료에 참가자 설문을 받을 수 있게. (마법사 토글 하나·기본 ON은 신규 생성 시)
--   시작 vs 종료 응답 변화 = outcome(추후 HP2030 리포트). 성별·연령대(230)와 교차해 형평성 분해.
--   programs.survey_enabled(기본 false — 기존 프로그램은 영향 없음, 마법사 신규 생성만 true 설정),
--   programs.survey_questions(jsonb·null이면 앱이 카테고리별 기본 문항 사용, 커스텀 편집은 phase 2),
--   survey_responses(참가자별 시작/종료 응답).
--   RLS: 본인 응답 CRUD + 프로그램 소유자(운영자)는 자기 프로그램 응답 조회.
--
-- 하위호환: 컬럼 추가(IF NOT EXISTS) + 새 테이블. 기존 코드/데이터 영향 없음(기본 false).
-- 복구: drop table survey_responses; alter table programs drop column survey_enabled, drop column survey_questions;
-- ============================================================

alter table public.programs add column if not exists survey_enabled boolean not null default false;
alter table public.programs add column if not exists survey_questions jsonb;  -- null = 카테고리 기본 문항

create table if not exists public.survey_responses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  program_id  uuid not null references public.programs(id) on delete cascade,
  phase       text not null check (phase in ('start', 'end')),
  answers     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, program_id, phase)
);
create index if not exists idx_survey_responses_program on public.survey_responses (program_id, phase);

alter table public.survey_responses enable row level security;

drop policy if exists "survey own select" on public.survey_responses;
create policy "survey own select" on public.survey_responses for select using (user_id = auth.uid());
drop policy if exists "survey own insert" on public.survey_responses;
create policy "survey own insert" on public.survey_responses for insert with check (user_id = auth.uid());
drop policy if exists "survey own update" on public.survey_responses;
create policy "survey own update" on public.survey_responses for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 운영자(프로그램 소유자)는 자기 프로그램 응답 조회 가능
drop policy if exists "survey owner select" on public.survey_responses;
create policy "survey owner select" on public.survey_responses for select
  using (exists (select 1 from public.programs p where p.id = program_id and p.owner_id = auth.uid()));
