-- ============================================================
-- Migration: 222 - 라벨 OCR 자동 검증 (mark_food_verified)
-- 작성일: 2026-08-15
-- 설명:
--   영양성분표(공식 라벨)를 OCR 해서 등록한 음식은 신뢰 가능 → 자동 ✓ 검증.
--   관리자 수동 검증 대신 owner 가 "라벨로 등록했음"을 마킹하는 RPC.
--   (베타 트레이드오프: 클라가 라벨 출처를 신뢰. 악용은 신고 3회 자동 비공개로 커버.
--    나중에 서버 서명으로 조일 수 있음.)
--
-- 하위호환: 신규 함수만 추가. 기존 verify_food(관리자)·submit_food 무변경.
-- 복구: drop function mark_food_verified(text);
-- ============================================================

create or replace function public.mark_food_verified(p_food_id text)
returns void
language sql security definer set search_path = public as $$
  update public.foods set verified = true
  where id = p_food_id and source = 'user' and submitted_by = auth.uid();
$$;

grant execute on function public.mark_food_verified(text) to authenticated;
