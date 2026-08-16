-- ============================================================
-- Migration: 229 - 목표 체중을 weight_goals 로 분리 (운영자도 설정 가능)
-- 작성일: 2026-08-17
-- 설명:
--   228 에서 목표 체중을 program_participants.target_weight 에 뒀는데,
--   운영자(owner)는 참여자 행이 없어서 set_weight_goal 이 0건 업데이트 → 저장 실패.
--   목표 체중은 "참여 여부와 무관한 개인 설정"이므로 별도 테이블로 분리:
--     weight_goals(user_id, program_id, target_weight) PK(user, program).
--   set_weight_goal 을 이 테이블 upsert 로 교체 → 운영자·참여자 모두 동작.
--   program_participants.target_weight 은 남겨두되 미사용(하위호환, 데이터 없음).
--
-- 하위호환: 새 테이블 + 함수 본문 교체(시그니처 동일). 조회 코드는 weight_goals 로 전환.
-- 복구: drop function set_weight_goal; drop table weight_goals; (228 의 UPDATE 버전으로 복원)
-- ============================================================

create table if not exists public.weight_goals (
  user_id       uuid not null references auth.users(id) on delete cascade,
  program_id    uuid not null references public.programs(id) on delete cascade,
  target_weight numeric(5,2),
  updated_at    timestamptz not null default now(),
  primary key (user_id, program_id)
);

alter table public.weight_goals enable row level security;

drop policy if exists "weight_goals own select" on public.weight_goals;
create policy "weight_goals own select" on public.weight_goals
  for select using (user_id = auth.uid());

drop policy if exists "weight_goals own insert" on public.weight_goals;
create policy "weight_goals own insert" on public.weight_goals
  for insert with check (user_id = auth.uid());

drop policy if exists "weight_goals own update" on public.weight_goals;
create policy "weight_goals own update" on public.weight_goals
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "weight_goals own delete" on public.weight_goals;
create policy "weight_goals own delete" on public.weight_goals
  for delete using (user_id = auth.uid());

-- set_weight_goal — weight_goals upsert (참여자 행 불필요 → 운영자도 저장됨)
create or replace function public.set_weight_goal(p_program uuid, p_target numeric)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.weight_goals (user_id, program_id, target_weight, updated_at)
  values (
    auth.uid(),
    p_program,
    case when p_target is null then null else greatest(20, least(p_target, 400)) end,
    now()
  )
  on conflict (user_id, program_id)
  do update set target_weight = excluded.target_weight, updated_at = now();
$$;

grant execute on function public.set_weight_goal(uuid, numeric) to authenticated;
