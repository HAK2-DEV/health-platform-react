-- ============================================================
-- Migration: 221 - 크라우드소싱 1b (공유·검증·신고)
-- 작성일: 2026-08-15
-- 설명:
--   개별 등록(1a) 위에 하이브리드 크라우드소싱을 얹는다.
--   · set_food_public  — 등록자 본인이 "모두에게 공유"(is_public) 토글.
--   · verify_food      — 관리자(is_admin)만 공유 음식 검증(✅ verified).
--   · food_reports     — 잘못된 공유 음식 신고. 3회 누적 시 자동 비공개(is_public=false).
--   가시성/검증 컬럼은 220 에 이미 존재 → 여기선 RPC + 신고 테이블만 추가.
--
-- 하위호환: 신규 함수/테이블만 추가. search_foods(220) 가 그대로 gov∪공개∪본인 노출.
-- 복구: drop function set_food_public, verify_food, report_food; drop table food_reports;
-- ============================================================

-- 공유 토글 — 등록자 본인만
create or replace function public.set_food_public(p_food_id text, p_on boolean)
returns void
language sql security definer set search_path = public as $$
  update public.foods set is_public = p_on
  where id = p_food_id and source = 'user' and submitted_by = auth.uid();
$$;
grant execute on function public.set_food_public(text, boolean) to authenticated;

-- 검증 토글 — 관리자만 (공유된 사용자 음식)
create or replace function public.verify_food(p_food_id text, p_on boolean)
returns void
language sql security definer set search_path = public as $$
  update public.foods set verified = p_on
  where id = p_food_id and source = 'user' and public.is_admin();
$$;
grant execute on function public.verify_food(text, boolean) to authenticated;

-- 신고 테이블 (1인 1건) — 관리자만 조회
create table if not exists public.food_reports (
  food_id    text not null references public.foods(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  reason     text,
  created_at timestamptz not null default now(),
  primary key (food_id, user_id)
);
alter table public.food_reports enable row level security;
drop policy if exists food_reports_admin_read on public.food_reports;
create policy food_reports_admin_read on public.food_reports
  for select using (public.is_admin());

-- 신고 접수 — 3회 누적 시 공개 풀에서 자동 내림(본인 검색엔 계속 보임)
create or replace function public.report_food(p_food_id text, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  insert into public.food_reports(food_id, user_id, reason)
  values (p_food_id, auth.uid(), nullif(btrim(coalesce(p_reason, '')), ''))
  on conflict (food_id, user_id) do update set reason = excluded.reason, created_at = now();

  select count(*) into n from public.food_reports where food_id = p_food_id;
  if n >= 3 then
    update public.foods set is_public = false, verified = false
    where id = p_food_id and source = 'user';
  end if;
end $$;
grant execute on function public.report_food(text, text) to authenticated;
