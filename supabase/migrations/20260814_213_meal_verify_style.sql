-- ============================================================
-- Migration: 213 - 식단 인증 스타일(verify_style 'meal') + 영양 저장
-- 작성일: 2026-08-14
-- 설명:
--   식단(DIET) 전용 5번째 인증 스타일 "식단 기록".
--   참여자가 (검색 or AI 사진)으로 먹은 음식을 담아 kcal·탄단지와 함께 제출.
--   끼니는 미션이 규정(아침/점심/저녁/간식) → missions.meal_type.
--
--   missions:
--     - verify_style 제약에 'meal' 추가 (기존 standard/meditation 유지).
--     - meal_type: 'breakfast'|'lunch'|'dinner'|'snack' (nullable). meal 스타일일 때만 의미.
--   verifications (인증 1건 = 한 끼):
--     - meal_kcal/carb/protein/fat: 집계용 숫자(오늘 섭취·주간 추이·끼니별).
--     - meal_items jsonb: 담은 음식 목록 [{name,grams,kcal,carb,protein,fat,maker}].
--     - meal_source: 'search'|'photo' (기록 방식). AI 사진은 근사치.
--
-- 하위호환: 전부 nullable/additive. 기존 미션·인증 영향 0. verify_style 제약은 넓히는 방향.
-- 복구:
--   alter table public.missions drop column if exists meal_type;
--   alter table public.verifications drop column if exists meal_kcal, ... (아래 5개);
--   alter table public.missions drop constraint if exists missions_verify_style_chk;
--   alter table public.missions add constraint missions_verify_style_chk check (verify_style in ('standard','meditation'));
-- ============================================================

-- missions: meal_type + verify_style 'meal' 허용
alter table public.missions
  add column if not exists meal_type text;

alter table public.missions drop constraint if exists missions_verify_style_chk;
alter table public.missions
  add constraint missions_verify_style_chk check (verify_style in ('standard', 'meditation', 'meal'));

-- verifications: 끼니 영양 + 담은 목록 + 기록 방식
alter table public.verifications
  add column if not exists meal_kcal    int,
  add column if not exists meal_carb    int,
  add column if not exists meal_protein int,
  add column if not exists meal_fat     int,
  add column if not exists meal_items   jsonb,
  add column if not exists meal_source  text;

-- 오늘 섭취·주간 추이 집계 가속 (meal 인증만)
create index if not exists idx_verifications_meal
  on public.verifications (user_id, mission_id, submitted_at)
  where meal_kcal is not null;
