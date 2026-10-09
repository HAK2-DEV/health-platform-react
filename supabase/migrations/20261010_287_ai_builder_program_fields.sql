-- ============================================================
-- Migration: 287 - 「AI와 함께 만들기」 프로그램 칸: 운영 기관·109 안내·대상 인원·성과 지표
-- 작성일: 2026-10-10
-- 설명:
--   AI 초안(엣지 함수 program-draft)을 DRAFT 프로그램으로 만들 때 담을 칸. 전부 선택 칸(NULL 또는 기본값)이라
--   기존 프로그램·기존 코드는 아무것도 바뀌지 않는다.
--     org_name            운영 기관 이름(기관이 운영할 때). 표지·소개의 「운영 ○○」(표시는 다음 단계).
--     org_logo_path       기관 로고(Storage 경로). 올리는 화면은 다음 단계 — 칸만 먼저 만든다.
--     crisis_line_enabled 마음 건강 프로그램의 «109 안내»를 소개와 따로 늘 보여 줄지.
--                         소개(description)와 떼어 둬서 운영자가 소개를 고쳐도 지워지지 않는다. 문구는 코드 상수(한 곳에서 관리).
--     target_headcount    대상 인원(계획서의 대상 인원). 참여율의 분모 — 도담은 가입자만 알고 «대상 전체»는 모른다.
--                         max_participants(정원)와 뜻이 다르다.
--     kpis                성과 지표 [{label, status: auto|setup|outside, done?}]. 종료 리포트 「목표 대비」가 읽는다(다음 단계).
--   권한: programs 의 기존 RLS(행 단위) 그대로. programs 는 칸 단위 GRANT 를 쓰지 않는다(2026-10-10 마이그 전체 확인).
--   트리거: 079(개설 한도)·098(updated_at)·190(종료 잠금) 은 칸 목록을 보지 않아 영향 없음.
--
-- 하위호환: ADD COLUMN IF NOT EXISTS · NOT NULL 은 DEFAULT 와 함께 · 제약은 이름으로 있으면 건너뜀(다시 돌려도 안전).
--   이 마이그만 먼저 올라가도 기존 코드는 그대로 돈다. 이 칸을 쓰는 코드(createProgramFromAiDraft)는 적용 «뒤에».
-- 복구: supabase/rollbacks/287_revert_ai_builder_program_fields.sql
-- ============================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS org_name TEXT,
  ADD COLUMN IF NOT EXISTS org_logo_path TEXT,
  ADD COLUMN IF NOT EXISTS crisis_line_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS target_headcount INT,
  ADD COLUMN IF NOT EXISTS kpis JSONB;

-- 값 범위 — 기관 이름은 표지에 들어갈 만큼, 인원은 양수, 지표는 배열
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'programs_org_name_len') THEN
    ALTER TABLE public.programs ADD CONSTRAINT programs_org_name_len
      CHECK (org_name IS NULL OR char_length(org_name) <= 40);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'programs_target_headcount_range') THEN
    ALTER TABLE public.programs ADD CONSTRAINT programs_target_headcount_range
      CHECK (target_headcount IS NULL OR target_headcount BETWEEN 1 AND 1000000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'programs_kpis_is_array') THEN
    ALTER TABLE public.programs ADD CONSTRAINT programs_kpis_is_array
      CHECK (kpis IS NULL OR jsonb_typeof(kpis) = 'array');
  END IF;
END $$;

COMMENT ON COLUMN public.programs.org_name IS '운영 기관 이름(AI와 함께 만들기·브랜딩). 표지·소개의 「운영 ○○」';
COMMENT ON COLUMN public.programs.org_logo_path IS '기관 로고 Storage 경로(올리는 화면은 다음 단계)';
COMMENT ON COLUMN public.programs.crisis_line_enabled IS '마음 건강 109 안내를 소개와 따로 늘 표시(문구는 코드 상수)';
COMMENT ON COLUMN public.programs.target_headcount IS '대상 인원(계획서) — 참여율 분모. max_participants(정원)와 다름';
COMMENT ON COLUMN public.programs.kpis IS '성과 지표 [{label, status: auto|setup|outside, done?}] — 종료 리포트 「목표 대비」';
