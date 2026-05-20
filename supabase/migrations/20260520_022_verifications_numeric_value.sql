-- ============================================================
-- Migration: 022 - verifications 에 numeric_value 컬럼 추가
-- 작성일: 2026-05-20
-- 설명: numeric_record 미션(만보 걷기, 운동 거리 등)의 숫자 기록 저장
--
-- 본인의 (다) 혼합 모델에서 features 다양화에 따른 진화:
--   image_upload   미션 → image_path 사용
--   numeric_record 미션 → numeric_value 사용
--   comment / like / quiz / body_metrics → 추후 진화 시 별도 컬럼/연계 테이블
--
-- NUMERIC(10, 2): 정수 8자리 + 소수 2자리.
--   걸음 수(10000), 거리(5.25km), 시간(30.5분) 등 다 수용.
--
-- 단위(unit)는 missions 테이블에 추후 추가 가능 (현재는 사용자 입력 placeholder 로 안내).
-- ============================================================

ALTER TABLE public.verifications
ADD COLUMN numeric_value NUMERIC(10, 2);
