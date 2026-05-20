-- ============================================================
-- Migration: 011 - programs 의 features 컬럼 추가
-- 작성일: 2026-05-20
-- 설명: 마법사 3단계의 기능 모듈 선택 (JSONB)
--
-- features JSONB - 운영자가 선택한 기능 모듈 (복수 선택)
--   {
--     "image_upload": true,    - 이미지 업로드
--     "comment": false,        - 댓글 작성
--     "like": false,           - 좋아요
--     "numeric_record": false, - 숫자 기록
--     "body_metrics": false,   - 신체 지표 (체중/체지방/골격근량)
--     "quiz": false,           - 퀴즈 풀이
--     "survey": false,         - 설문 (미래)
--     "approval_required": false - 인증 승인 필요
--   }
--
-- 본인의 미래 진화: 새 기능 모듈 추가 시 마이그레이션 X.
-- JSONB 의 진짜 가치 - 진화 자유.
--
-- 본인의 3-4단계 연동:
--   3단계에서 활성화 (true) 된 기능 → 4단계에서 점수 규칙 설정
-- ============================================================

ALTER TABLE public.programs
ADD COLUMN features JSONB NOT NULL DEFAULT '{}'::jsonb;