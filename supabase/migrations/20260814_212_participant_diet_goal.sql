-- ============================================================
-- Migration: 212 - 참여자 개인 식단 목표(daily_kcal_goal) + set_diet_goal RPC
-- 작성일: 2026-08-14
-- 설명:
--   식단 카테고리 개요에서 "목표 칼로리"를 운영자가 아니라 개별 참여자가 설정한다.
--   program_participants 에 daily_kcal_goal(int, nullable) 추가 —
--   NULL 이면 클라에서 카테고리 기본값(1,800kcal) 로 폴백.
--   쓰기는 SECURITY DEFINER RPC 로 본인(auth.uid()) 참여행만 갱신(컬럼 스코프 안전).
--   읽기는 기존 참여행 SELECT 정책으로 처리(본인 행 조회 가능).
--
-- 하위호환: 컬럼 추가(IF NOT EXISTS, nullable) + 새 함수. 기존 코드 영향 없음.
-- 복구: drop function public.set_diet_goal(uuid,int); alter table ... drop column daily_kcal_goal;
-- ============================================================

alter table public.program_participants
  add column if not exists daily_kcal_goal int;

-- 본인 참여행의 목표 kcal 만 갱신 (500~10000 클램프)
create or replace function public.set_diet_goal(p_program uuid, p_goal int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.program_participants
     set daily_kcal_goal = greatest(500, least(coalesce(p_goal, 1800), 10000))
   where program_id = p_program
     and user_id = auth.uid();
$$;

grant execute on function public.set_diet_goal(uuid, int) to authenticated;
