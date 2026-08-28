-- 248 복구 — 신청 개방 시각 컬럼 DROP.
-- 주의: 운영자가 지정한 개방 시각 설정이 사라진다(게이팅은 클래스 시작 시각 기준으로 되돌아감).

ALTER TABLE public.programs
  DROP COLUMN IF EXISTS class_signup_open_time;

ALTER TABLE public.sessions
  DROP COLUMN IF EXISTS signup_open_time;
