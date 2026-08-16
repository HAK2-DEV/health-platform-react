-- ============================================================
-- Migration: 228 - 체중/허리둘레 기록(weight_logs) + 목표체중(target_weight)
-- 작성일: 2026-08-16
-- 설명:
--   식단 「내 변화」 탭의 체중 곡선용. 체중은 미션이 아니라 이 테이블에만 기록(운영자 비노출·본인만).
--   weight_logs: 참여자가 날짜별로 체중/허리둘레/컨디션/한줄회고 기록. (user, program, logged_date) 유니크 → upsert.
--   RLS: 본인(auth.uid()) 행만 조회·삽입·수정·삭제. 운영자·타인 접근 불가(민감정보).
--   program_participants.target_weight: 본인 목표 체중(nullable). 쓰기는 set_weight_goal RPC(본인 행만).
--
-- 하위호환: 새 테이블 + 컬럼 추가(IF NOT EXISTS) + 새 함수. 기존 코드/데이터 영향 없음.
-- 복구:
--   drop function public.set_weight_goal(uuid, numeric);
--   alter table public.program_participants drop column target_weight;
--   drop table public.weight_logs;
-- ============================================================

-- 1) 체중/허리둘레 기록 테이블
create table if not exists public.weight_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  program_id  uuid not null references public.programs(id) on delete cascade,
  logged_date date not null,
  weight      numeric(5,2),   -- kg
  waist       numeric(5,2),   -- cm
  mood        int,            -- 1~5 컨디션(선택)
  memo        text,           -- 한 줄 회고(선택)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, program_id, logged_date)
);

create index if not exists idx_weight_logs_user_program
  on public.weight_logs (user_id, program_id, logged_date);

-- 2) RLS — 본인 행만 (민감정보: 운영자·타인 접근 차단)
alter table public.weight_logs enable row level security;

drop policy if exists "weight_logs own select" on public.weight_logs;
create policy "weight_logs own select" on public.weight_logs
  for select using (user_id = auth.uid());

drop policy if exists "weight_logs own insert" on public.weight_logs;
create policy "weight_logs own insert" on public.weight_logs
  for insert with check (user_id = auth.uid());

drop policy if exists "weight_logs own update" on public.weight_logs;
create policy "weight_logs own update" on public.weight_logs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "weight_logs own delete" on public.weight_logs;
create policy "weight_logs own delete" on public.weight_logs
  for delete using (user_id = auth.uid());

-- 3) 목표 체중 — 참여자 본인 설정
alter table public.program_participants
  add column if not exists target_weight numeric(5,2);

create or replace function public.set_weight_goal(p_program uuid, p_target numeric)
returns void
language sql
security definer
set search_path = public
as $$
  update public.program_participants
     set target_weight = case when p_target is null then null
                              else greatest(20, least(p_target, 400)) end
   where program_id = p_program
     and user_id = auth.uid();
$$;

grant execute on function public.set_weight_goal(uuid, numeric) to authenticated;
