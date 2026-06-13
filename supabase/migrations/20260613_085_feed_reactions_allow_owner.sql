-- ============================================================
-- Migration: 085 - 피드 좋아요/댓글에 프로그램 소유자(운영자) 허용
-- 작성일: 2026-06-13
-- 설명:
--   036 의 post_likes / post_comments RLS 는 "feed_enabled 프로그램의 ACTIVE 참여자"
--   만 SELECT/INSERT 를 허용했음. 그래서 프로그램 소유자(운영자)가 본인 프로그램으로
--   참여(participant)하지 않은 경우, 피드에서 좋아요·댓글을 달 수 없었음
--   (INSERT 시 "new row violates row-level security policy for table post_comments").
--
--   해결: 4개 정책(post_likes SELECT/INSERT, post_comments SELECT/INSERT)을
--   "owner_id = auth.uid() OR ACTIVE 참여자" 로 재정의. 소유자도 본인 피드에
--   반응을 보고/남길 수 있게 함.
--
--   참고: 피드 게시물(verifications) SELECT 는 037 에서 이미 소유자 허용됨.
--
-- 복구: 036 의 원본 정책 4개로 DROP + CREATE 복원.
-- ============================================================

-- ─── post_likes ─────────────────────────────────────────────
DROP POLICY IF EXISTS "view likes of feed-enabled program" ON public.post_likes;
CREATE POLICY "view likes of feed-enabled program"
ON public.post_likes
FOR SELECT
TO authenticated
USING (
  verification_id IN (
    SELECT v.id FROM public.verifications v
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

DROP POLICY IF EXISTS "insert own like on feed-enabled program" ON public.post_likes;
CREATE POLICY "insert own like on feed-enabled program"
ON public.post_likes
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND verification_id IN (
    SELECT v.id FROM public.verifications v
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

-- ─── post_comments ──────────────────────────────────────────
DROP POLICY IF EXISTS "view comments of feed-enabled program" ON public.post_comments;
CREATE POLICY "view comments of feed-enabled program"
ON public.post_comments
FOR SELECT
TO authenticated
USING (
  verification_id IN (
    SELECT v.id FROM public.verifications v
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

DROP POLICY IF EXISTS "insert own comment on feed-enabled program" ON public.post_comments;
CREATE POLICY "insert own comment on feed-enabled program"
ON public.post_comments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND verification_id IN (
    SELECT v.id FROM public.verifications v
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
