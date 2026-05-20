-- ============================================================
-- Migration: 017 - features → missions 자동 생성 트리거 + 기존 PUBLISHED 백필
-- 작성일: 2026-05-20
-- 설명: 본인의 (다) 혼합 모델의 핵심.
--       programs 가 PUBLISHED 로 진입할 때 features+score_rules 를 읽어
--       missions 테이블에 자동 INSERT.
--
-- 구성:
--   1) apply_missions_from_program(p_program_id)
--      - 공통 로직 함수 (트리거 + 백필 둘 다 호출)
--      - SECURITY DEFINER 로 RLS 우회
--   2) create_missions_on_publish() — 트리거 함수
--      - INSERT 시 NEW.status='PUBLISHED' 인 케이스
--      - UPDATE 시 status 가 DRAFT→PUBLISHED 로 전환되는 케이스
--   3) 트리거 등록 (programs 의 INSERT/UPDATE)
--   4) 백필 — 이미 PUBLISHED 인 프로그램에 대해 missions 생성
--
-- title 매핑 (feature key → 한글 라벨):
--   image_upload  → '사진 인증'
--   numeric_record→ '기록 입력'
--   comment       → '댓글 작성'
--   like          → '좋아요'
--   quiz          → '퀴즈 풀이'
--   body_metrics  → '신체 지표 입력'
--
-- 중복 방지: missions UNIQUE(program_id, feature) + ON CONFLICT DO NOTHING
-- ============================================================

-- 1) 공통 로직 함수
CREATE OR REPLACE FUNCTION public.apply_missions_from_program(p_program_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program RECORD;
  v_feature_key TEXT;
  v_rule JSONB;
  v_title TEXT;
BEGIN
  -- 프로그램 조회
  SELECT id, features, score_rules, approval_mode, start_date, end_date
  INTO v_program
  FROM public.programs
  WHERE id = p_program_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- features 각 키별로 missions INSERT
  FOR v_feature_key IN
    SELECT jsonb_object_keys(COALESCE(v_program.features, '{}'::jsonb))
  LOOP
    -- 켜진 feature 만 처리
    IF NOT COALESCE((v_program.features->v_feature_key)::boolean, false) THEN
      CONTINUE;
    END IF;

    -- 해당 feature 의 점수 규칙
    v_rule := v_program.score_rules->v_feature_key;

    -- 한글 라벨 매핑
    v_title := CASE v_feature_key
      WHEN 'image_upload'   THEN '사진 인증'
      WHEN 'numeric_record' THEN '기록 입력'
      WHEN 'comment'        THEN '댓글 작성'
      WHEN 'like'           THEN '좋아요'
      WHEN 'quiz'           THEN '퀴즈 풀이'
      WHEN 'body_metrics'   THEN '신체 지표 입력'
      ELSE v_feature_key
    END;

    -- INSERT (중복 시 무시 — 안전망)
    INSERT INTO public.missions (
      program_id, feature, title,
      verification_type, point, daily_limit,
      active_from, active_until
    )
    VALUES (
      v_program.id,
      v_feature_key,
      v_title,
      COALESCE(v_program.approval_mode, 'AUTO'),
      COALESCE((v_rule->>'score')::int, 0),
      (v_rule->>'daily_limit')::int,
      v_program.start_date::timestamptz,
      v_program.end_date::timestamptz
    )
    ON CONFLICT (program_id, feature) DO NOTHING;
  END LOOP;
END;
$$;


-- 2) 트리거 함수: PUBLISHED 진입 시점
CREATE OR REPLACE FUNCTION public.create_missions_on_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- PUBLISHED 가 아니면 무시
  IF NEW.status != 'PUBLISHED' THEN
    RETURN NEW;
  END IF;

  -- UPDATE: 이전에도 PUBLISHED 였다면 중복 생성 방지
  IF TG_OP = 'UPDATE' AND OLD.status = 'PUBLISHED' THEN
    RETURN NEW;
  END IF;

  -- 공통 로직 호출
  PERFORM public.apply_missions_from_program(NEW.id);

  RETURN NEW;
END;
$$;


-- 3) 트리거 등록 (INSERT 직접 PUBLISHED 케이스 + UPDATE 시 status 전환 케이스)
DROP TRIGGER IF EXISTS create_missions_on_program_publish ON public.programs;
CREATE TRIGGER create_missions_on_program_publish
AFTER INSERT OR UPDATE OF status ON public.programs
FOR EACH ROW
EXECUTE FUNCTION public.create_missions_on_publish();


-- 4) 백필: 이미 PUBLISHED 인 프로그램에 missions 생성
DO $$
DECLARE
  v_program_id UUID;
BEGIN
  FOR v_program_id IN
    SELECT id FROM public.programs WHERE status = 'PUBLISHED'
  LOOP
    PERFORM public.apply_missions_from_program(v_program_id);
  END LOOP;
END $$;
