-- ============================================================
-- Migration: 195 - 아낀 담배 지표 라벨 변경 (아낀 담배 → 오늘 피려다가 참은 담배)
-- 작성일: 2026-08-02
-- 설명:
--   금연 프리셋 미션 「오늘 아낀 담배」의 지표 라벨을 더 쉬운 표현으로 변경.
--   프리셋 코드(src/lib/programLibrary.js)는 이미 변경됨 — 프리셋으로 이미 생성된
--   미션(missions.metrics JSONB)에 복사된 라벨을 동일하게 갱신한다.
--   metrics 배열에서 label='아낀 담배' 인 요소의 label 만 교체(순서·다른 키 보존).
--   idempotent: 재실행 시 매칭 행이 없어 no-op. 하위호환(데이터 전용).
--
-- 복구:
--   동일 UPDATE 를 값만 반대로 실행:
--     '오늘 피려다가 참은 담배' → '아낀 담배'
-- ============================================================

UPDATE public.missions
SET metrics = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'label' = '아낀 담배'
      THEN elem || jsonb_build_object('label', '오늘 피려다가 참은 담배')
      ELSE elem
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(metrics) WITH ORDINALITY AS t(elem, ord)
)
WHERE metrics @> '[{"label": "아낀 담배"}]'::jsonb;
