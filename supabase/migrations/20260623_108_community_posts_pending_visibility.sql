-- ============================================================
-- Migration: 108 - community_posts 검토 대기(pending) 글 가시성 강제
-- 작성일: 2026-06-23
-- 설명:
--   문제: 「승인 필요」 게시판의 pending 글을 다른 참여자도 볼 수 있어
--         검토 대기의 의미가 사라짐.
--   원인(추정): RLS SELECT 정책은 여러 개면 OR 로 합쳐짐. 과거 개발 중 만들어진
--         느슨한 SELECT 정책이 남아 있으면, 096 의 올바른 정책과 OR 되어 pending 이 노출됨.
--   해결: community_posts 의 모든 SELECT 정책을 제거하고, 올바른 정책 "1개"만 재생성.
--         읽기 = 작성자 본인 / 운영자(전체) / 참여자(status='visible' 만). (096 과 동일 기준)
--
--   하위호환: 정상 권한은 그대로(작성자·운영자·visible 참여자). pending 의 타인 노출만 차단.
--   INSERT/UPDATE/DELETE 정책은 건드리지 않음.
--
-- 복구:
--   이 마이그레이션이 정책을 표준화하므로 별도 롤백 불필요.
--   (필요 시 096 의 SELECT 정책 블록을 다시 실행)
-- ============================================================

-- 1) community_posts 의 기존 SELECT 정책 전부 제거 (이름 불문 — 느슨한 잔존 정책 포함)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.community_posts'::regclass
      AND polcmd = 'r'   -- r = SELECT
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.community_posts', r.polname);
  END LOOP;
END $$;

-- 2) 올바른 SELECT 정책 1개만 재생성
CREATE POLICY "community_posts select" ON public.community_posts
FOR SELECT TO authenticated
USING (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.owner_id = auth.uid())
  OR (status = 'visible' AND public._is_active_participant(program_id, auth.uid()))
);
