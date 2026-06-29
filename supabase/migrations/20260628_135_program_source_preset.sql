-- ============================================================
-- Migration: 135 - 라이브러리 프리셋 출처 추적 + 프리셋별 운영자 수 집계
-- 작성일: 2026-06-28
-- 설명:
--   1) programs.source_preset_key (TEXT, nullable) 추가.
--      라이브러리 프리셋에서 생성된 프로그램이면 프리셋 key 저장(예: 'run_3km'),
--      직접 생성/기존 행은 NULL. 하위호환(기본 NULL — 기존 코드/행 영향 없음).
--   2) get_preset_usage_counts() RPC — 라이브러리 화면 "N명의 운영자가 시작했어요" 표시용.
--      source_preset_key 가 NOT NULL 인 programs 를 그룹화해
--      preset_key 별 COUNT(DISTINCT owner_id) 반환.
--      SECURITY DEFINER 로 RLS 우회 — 운영자가 남의 프로그램 row 를 못 읽어도
--      집계 수치만 얻게 함(개별 프로그램 노출 없음).
--
-- 영향: programs 테이블(컬럼 1개 추가) + 신규 함수 1개. 기존 동작 불변.
--
-- 복구:
--   DROP FUNCTION IF EXISTS public.get_preset_usage_counts();
--   ALTER TABLE public.programs DROP COLUMN IF EXISTS source_preset_key;
-- ============================================================

-- 1) 출처 프리셋 key (nullable — 직접 생성/기존 행은 NULL)
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS source_preset_key TEXT;

-- 2) 프리셋별 운영자 수 집계 (집계 수치만 노출, 개별 프로그램 비노출)
CREATE OR REPLACE FUNCTION public.get_preset_usage_counts()
RETURNS TABLE (preset_key TEXT, operator_count INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT source_preset_key AS preset_key,
         COUNT(DISTINCT owner_id)::INT AS operator_count
  FROM public.programs
  WHERE source_preset_key IS NOT NULL
  GROUP BY source_preset_key;
$$;

GRANT EXECUTE ON FUNCTION public.get_preset_usage_counts() TO authenticated;
