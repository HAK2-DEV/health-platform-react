-- ============================================================
-- Migration: 094 - 커뮤니티 레이아웃 4종 확장 (feed 추가)
-- 작성일: 2026-06-20
-- 설명:
--   093 의 3종(list/grid/magazine)에 'feed' 추가 → 4종.
--     'feed'     = 피드형 (인스타 스타일 풀 카드) — 기존 'list' 의 실제 동작
--     'list'     = 리스트형 (썸네일 좌 + 텍스트 우, 균일 가로 행) — 의미 재정의
--     'grid'     = 그리드형 (2열 카드)
--     'magazine' = 매거진형 (대/소 혼합 + 오버레이)
--   기존 'list'(= 풀카드 기본값)은 동작이 'feed'와 같으므로 'feed'로 이전(외형 보존).
--   기본값도 'feed'(기존 동작 유지).
--
-- 복구: 'feed'→'list' 되돌리고 CHECK 를 3종으로.
-- ============================================================

-- 1) 기존 CHECK 제거 (feed 로 UPDATE 가능하게)
ALTER TABLE public.programs DROP CONSTRAINT IF EXISTS programs_community_layout_check;

-- 2) 기존 'list'(=풀카드) → 'feed' 로 이전 (외형 유지)
UPDATE public.programs SET community_layout = 'feed' WHERE community_layout = 'list';

-- 3) 기본값 feed
ALTER TABLE public.programs ALTER COLUMN community_layout SET DEFAULT 'feed';

-- 4) 4종 CHECK 재적용
ALTER TABLE public.programs
  ADD CONSTRAINT programs_community_layout_check
  CHECK (community_layout IN ('feed', 'list', 'grid', 'magazine'));
