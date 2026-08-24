-- ============================================================
-- Migration: 244 - verify_style 'steps' 허용 (걸음 자동 인증)
-- 작성일: 2026-08-24
-- 설명:
--   243에서 step_goal 컬럼은 추가했으나 missions_verify_style_chk 제약에
--   'steps' 를 못 넣어, verify_style='steps' 미션 INSERT 가 CHECK 위반으로 실패했음.
--   제약을 넓혀 'steps' 를 허용한다. (standard/meditation/meal 유지 — 넓히는 방향)
--
-- 복구:
--   alter table public.missions drop constraint if exists missions_verify_style_chk;
--   alter table public.missions
--     add constraint missions_verify_style_chk
--       check (verify_style in ('standard','meditation','meal'));
-- ============================================================

alter table public.missions drop constraint if exists missions_verify_style_chk;
alter table public.missions
  add constraint missions_verify_style_chk
    check (verify_style in ('standard', 'meditation', 'meal', 'steps'));
