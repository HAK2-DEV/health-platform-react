-- ============================================================
-- Migration: 226 - foods 영양소 확장 (당류·포화/트랜스지방·콜레스테롤·식이섬유)
-- 작성일: 2026-08-15
-- 설명:
--   정부 통합식품영양성분 API 가 제공하는 추가 영양소 컬럼 확보(나트륨은 이미 있음).
--   food-ingest 재적재로 32만 건 백필 예정. 컬럼만 추가(additive).
--   값 정밀도: MVP 는 정수(g/mg 반올림). 트랜스/포화지방 소수는 추후 numeric 로 정밀화 가능.
--
-- 하위호환: nullable 컬럼 추가 → 즉시, 재적재 전엔 NULL(클라에서 미표시).
-- 복구: alter table foods drop column sugar, sat_fat, trans_fat, cholesterol, fiber;
-- ============================================================

alter table public.foods add column if not exists sugar       int;   -- 당류(g)
alter table public.foods add column if not exists sat_fat     int;   -- 포화지방(g)
alter table public.foods add column if not exists trans_fat   int;   -- 트랜스지방(g)
alter table public.foods add column if not exists cholesterol int;   -- 콜레스테롤(mg)
alter table public.foods add column if not exists fiber       int;   -- 식이섬유(g)
