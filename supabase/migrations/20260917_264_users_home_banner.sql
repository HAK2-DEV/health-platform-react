-- ============================================================
-- Migration: 264 - 대시보드 인사 배너 사진 (개인별)
-- 작성일: 2026-09-17
-- 설명:
--   대시보드 상단 인사 배너의 배경이 /home-header.jpg 하드코딩이라 모두 같은 그림이었다.
--   「여기 뒤에 사진도 편집할 수 있게 해달라」 요청(2026-09-17)에 따라 «각자» 자기 배너를
--   고를 수 있게 한다. 값은 profile-avatars 버킷(PUBLIC) 안의 경로 — 아바타와 같은 버킷을
--   쓰는 이유는 050 마이그레이션의 본인 폴더 upload/update/delete 정책을 그대로 재사용하기
--   위해서다(새 버킷·새 정책이 필요 없다).
--
--   NULL = 기본 일러스트(/home-header.jpg) 사용. 본인 결정: 안 바꾼 사람은 지금 그림 유지.
--   갱신은 003 의 «users can update own profile» 행 단위 정책으로 가능 — 추가 정책 불필요.
--   하위호환: nullable 컬럼 추가뿐이라 기존 코드·행에 영향 없음.
--
-- 복구:
--   ALTER TABLE public.users DROP COLUMN IF EXISTS home_banner_path;
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS home_banner_path text;

COMMENT ON COLUMN public.users.home_banner_path IS
  '대시보드 인사 배너 배경 사진 경로(profile-avatars 버킷). NULL=기본 일러스트(/home-header.jpg).';

-- ⚠️ 컬럼 단위 권한 (2026-09-17 실기기에서 발견 — 이게 빠져서 대시보드가 통째로 403 이었다)
--   public.users 는 authenticated 역할에 «컬럼 목록» 으로 SELECT 가 부여돼 있다. 테이블 단위가
--   아니라서 «새로 추가한 컬럼은 자동으로 포함되지 않는다». 그 상태로 select('nickname, home_banner_path')
--   를 하면 PostgREST 가 42501 permission denied 를 내고, 닉네임까지 함께 안 나온다(RLS 는 통과한다).
--   증상: 배너는 저장되는데(UPDATE 는 됨) 화면에는 기본 일러스트 + 「반가워요」.
--   앞으로 users 에 컬럼을 추가할 때는 이 GRANT 를 같이 넣을 것.
GRANT SELECT (home_banner_path) ON public.users TO authenticated;
GRANT UPDATE (home_banner_path) ON public.users TO authenticated;
