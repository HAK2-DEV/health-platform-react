-- ============================================================
-- Migration: 028 - 미션 인증 유형 확장 (소감) + 운영자 직접 생성 미션 지원
-- 작성일: 2026-05-21
-- 설명: 본인의 새 (가) 진화 — 운영자가 자유롭게 미션 추가.
--   인증 유형 3가지: 사진(image) / 기록(numeric) / 소감(note)
--
-- 변경:
--   1) missions.requires_note BOOLEAN DEFAULT false — 소감 텍스트 필수 여부
--   2) verifications.note TEXT — 참여자의 소감 텍스트
--   3) missions.feature 를 NULLABLE 로 변경
--      - feature 가 채워진 행 = features 자동 생성 미션 (017 트리거)
--      - feature 가 NULL 인 행 = 운영자가 직접 추가한 미션
--      - UNIQUE(program_id, feature) 는 그대로 유지 — NULL 은 UNIQUE 검사에서 제외되어
--        운영자가 같은 프로그램에 여러 미션 자유롭게 추가 가능
--
-- 기존 데이터:
--   feature 가 'image_upload' 같이 채워진 행 (017 트리거 자동 생성) 그대로 보존.
--   본인이 미래에 features 자동 생성 폐기 결정 시 별도 마이그레이션.
-- ============================================================

ALTER TABLE public.missions
ADD COLUMN requires_note BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.missions
ALTER COLUMN feature DROP NOT NULL;

ALTER TABLE public.verifications
ADD COLUMN note TEXT;
