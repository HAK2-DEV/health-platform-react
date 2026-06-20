-- ============================================================
-- Migration: 093 - 커뮤니티 피드 레이아웃 선택
-- 작성일: 2026-06-20
-- 설명:
--   커뮤니티 관리자에서 운영자가 게시글 배치를 고를 수 있도록 컬럼 추가.
--     'list'     = 리스트형 (한 줄 1개, 썸네일+텍스트) — 기본값(기존 동작)
--     'grid'     = 그리드형 (2열 카드 + 상단 대표글)
--     'magazine' = 매거진형 (대/소 혼합 + 이미지 위 오버레이)
--   NULL/미적용 시 코드에서 'list' 로 처리(하위호환).
--
-- 복구: ALTER TABLE public.programs DROP COLUMN IF EXISTS community_layout;
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS community_layout TEXT NOT NULL DEFAULT 'list'
    CHECK (community_layout IN ('list', 'grid', 'magazine'));
