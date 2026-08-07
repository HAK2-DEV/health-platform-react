-- ============================================================
-- Migration: 201 - 명상(타이머) 인증 스타일 — missions 컬럼 추가
-- 작성일: 2026-08-06
-- 설명:
--   마음관리(MINDCARE) 전용 4번째 인증 스타일 "명상".
--   사진/기록/소감 대신 타이머 완료로 인증(자기보고 신뢰 → AUTO 승인).
--   운영자가 명상 시간·호흡 패턴·음악을 설정.
--     - verify_style      : 'standard'(기존) | 'meditation'. 기본 standard → 기존 미션 영향 0.
--     - meditation_seconds: 명상 길이(초). meditation 일 때만 의미(예: 180=3분).
--     - meditation_pattern: 호흡 패턴 JSONB {inhale,hold1,exhale,hold2}(초).
--                           null = 클라 기본(박스 호흡 4-4-4-4). 운영자 커스텀 가능.
--     - meditation_music  : 음악 트랙 키/경로(선택). null = 기본 트랙.
--   영향: missions 에 nullable/default 컬럼 추가만 → 완전 하위호환.
--         (meditation 미션은 requires_image/numeric/note 모두 false 로 저장, 인증은 완료 레코드.)
--
-- 복구:
--   ALTER TABLE public.missions
--     DROP COLUMN IF EXISTS verify_style,
--     DROP COLUMN IF EXISTS meditation_seconds,
--     DROP COLUMN IF EXISTS meditation_pattern,
--     DROP COLUMN IF EXISTS meditation_music;
--   ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_verify_style_chk;
-- ============================================================

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS verify_style       TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS meditation_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS meditation_pattern JSONB,
  ADD COLUMN IF NOT EXISTS meditation_music   TEXT;

-- verify_style 허용값 제약 (standard / meditation)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'missions_verify_style_chk') THEN
    ALTER TABLE public.missions
      ADD CONSTRAINT missions_verify_style_chk CHECK (verify_style IN ('standard', 'meditation'));
  END IF;
END $$;
