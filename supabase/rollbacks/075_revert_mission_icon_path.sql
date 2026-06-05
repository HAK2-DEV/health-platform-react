-- 075 복구 — missions.icon_path 컬럼 DROP.
-- 주의: 이미 라이브러리에서 추가된 미션의 icon_path 값은 손실됨.

ALTER TABLE public.missions
  DROP COLUMN IF EXISTS icon_path;
