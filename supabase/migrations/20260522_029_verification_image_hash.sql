-- ============================================================
-- Migration: 029 - verifications.image_hash + 본인 단위 중복 사진 차단
-- 작성일: 2026-05-22
-- 설명: 본인 첫 명시 진화 항목 — 같은 사진 N번 올려서 점수 증식 차단.
--
-- 컬럼:
--   image_hash TEXT NULL — 클라이언트가 계산한 SHA-256 (64자 hex)
--     이미지 인증만 채움. note/numeric 만 인증은 NULL.
--
-- UNIQUE INDEX (partial):
--   (user_id, image_hash) WHERE image_hash IS NOT NULL
--   → 같은 user_id 가 같은 image_hash 로 두 번 INSERT 못 함
--   → image_hash 가 NULL 인 행 (note/numeric 인증) 은 UNIQUE 검사에서 제외
--
-- 한계 (메모): 사진을 약간 압축/포맷 변경하면 해시 달라져 우회 가능.
--   100% 위조 방지는 아니고 단순 중복 차단. 본인 미래 비전 AI 이미지 판별이 완전 해결.
--
-- 본인 단위 vs 시스템 전체:
--   user_id 별 — 본인이 자기 사진 N번 못 올림. 다른 사용자는 같은 사진 자유.
--   (디지털 사용권 관점에서 자연스러움)
-- ============================================================

ALTER TABLE public.verifications
ADD COLUMN image_hash TEXT;

-- 본인 단위 중복 차단 (partial unique index)
CREATE UNIQUE INDEX idx_verifications_user_image_hash
ON public.verifications (user_id, image_hash)
WHERE image_hash IS NOT NULL;
