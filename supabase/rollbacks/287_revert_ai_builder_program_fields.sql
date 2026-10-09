-- 287 되돌리기 — 「AI와 함께 만들기」 프로그램 칸 삭제.
--   ⚠️ 칸에 담긴 값(기관 이름·109 안내 여부·대상 인원·성과 지표)도 함께 사라진다.
--   순서: 이 칸을 쓰는 코드(createProgramFromAiDraft·aiDraftProgramFields)를 먼저 되돌린 뒤에 돌린다.
ALTER TABLE public.programs
  DROP CONSTRAINT IF EXISTS programs_org_name_len,
  DROP CONSTRAINT IF EXISTS programs_target_headcount_range,
  DROP CONSTRAINT IF EXISTS programs_kpis_is_array,
  DROP COLUMN IF EXISTS org_name,
  DROP COLUMN IF EXISTS org_logo_path,
  DROP COLUMN IF EXISTS crisis_line_enabled,
  DROP COLUMN IF EXISTS target_headcount,
  DROP COLUMN IF EXISTS kpis;
