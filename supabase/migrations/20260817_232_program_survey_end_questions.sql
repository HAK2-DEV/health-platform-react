-- ============================================================
-- Migration: 232 - 종료 설문 독립 문항 세트
-- 작성일: 2026-08-17
-- 설명:
--   시작/종료 설문 문항을 각각 독립적으로 편집할 수 있게(종료도 단답·척도 추가/삭제/순서).
--   programs.survey_questions = 시작 문항, 신규 programs.survey_questions_end = 종료 문항.
--   null 이면 앱이 fallback: 종료 null → (시작 커스텀 있으면 그걸, 없으면 카테고리 기본 종료문구).
--   → 시작만 커스텀해도 종료가 같은 문항을 물어 변화(outcome) 측정이 그대로 성립.
--
-- 하위호환: 컬럼 추가(IF NOT EXISTS·nullable). 기존 코드/데이터 영향 없음(null=기존 동작).
-- 복구: alter table public.programs drop column if exists survey_questions_end;
-- ============================================================

alter table public.programs add column if not exists survey_questions_end jsonb;  -- null = fallback(시작 문항 or 기본)
