-- ============================================================
-- Migration: 143 - post_comment_likes 에 프로그램 소유자(운영자) 허용
-- 작성일: 2026-06-29
-- 설명:
--   141 의 post_comment_likes RLS 는 "feed_enabled 프로그램의 ACTIVE 참여자"만
--   SELECT/INSERT 를 허용했음. 그래서 본인 프로그램에 참여(participant)하지 않은
--   운영자가 응원 댓글에 좋아요를 누르면 RLS 위반
--   ("new row violates row-level security policy for table post_comment_likes").
--
--   해결: 085(피드 좋아요/댓글 owner 허용)와 동일하게, SELECT/INSERT 정책을
--   "owner_id = auth.uid() OR ACTIVE 참여자" 로 재정의. (142 게시판 댓글 좋아요는
--   생성 시 이미 owner 경로 포함됨 — 짝맞춤.)
--
-- 영향: 권한을 넓히는 방향(기존 참여자 차단 없음). DELETE/ADMIN 정책은 불변.
--
-- 복구: 141 의 원본 SELECT/INSERT 정책으로 DROP + CREATE 복원.
-- ============================================================

DROP POLICY IF EXISTS "view comment likes of feed program" ON public.post_comment_likes;
CREATE POLICY "view comment likes of feed program"
ON public.post_comment_likes FOR SELECT TO authenticated
USING (
  comment_id IN (
    SELECT c.id FROM public.post_comments c
    JOIN public.verifications v ON v.id = c.verification_id
    JOIN public.missions m ON m.id = v.mission_id
    JOIN public.programs p ON p.id = m.program_id
    WHERE p.feed_enabled = true
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.program_participants pp
          WHERE pp.program_id = p.id AND pp.user_id = auth.uid() AND pp.status = 'ACTIVE'
        )
      )
  )
);

DROP POLICY IF EXISTS "insert own comment like" ON public.post_comment_likes;
CREATE POLICY "insert own comment like"
ON public.post_comment_likes FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND comment_id IN (
    SELECT c.id FROM public.post_comments c
    JOIN public.verifications v ON v.id = c.verification_id
    JOIN public.missions m ON m.id = v.mission_id
    JOIN public.programs p ON p.id = m.program_id
    WHERE p.feed_enabled = true
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.program_participants pp
          WHERE pp.program_id = p.id AND pp.user_id = auth.uid() AND pp.status = 'ACTIVE'
        )
      )
  )
);
