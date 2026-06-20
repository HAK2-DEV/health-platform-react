-- ============================================================
-- Migration: 096 - 커뮤니티 게시판 글쓰기 (community_posts)
-- 작성일: 2026-06-20
-- 설명:
--   자유/공지/질문 등 게시판 글. (인증 게시판은 기존 verifications 피드 사용)
--   게시판별 권한은 programs.community_settings->boards[].writePerm 로 제어:
--     'free'     = 참여자 자유 작성 (즉시 노출)
--     'approval' = 참여자 작성 가능하나 status='pending' (운영자 검토 후 노출)
--     'readonly' = 운영자만 작성
--   status: visible(노출) / pending(검토 대기) / hidden(운영자 숨김·신고)
--
-- 복구: DROP TABLE public.community_posts; + 함수/트리거 DROP.
-- ============================================================

-- ─── 1) 테이블 ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  board_id TEXT NOT NULL,                         -- community_settings.boards[].id
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT NOT NULL,
  image_path TEXT,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'pending', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_posts_program ON public.community_posts(program_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_board ON public.community_posts(program_id, board_id, created_at DESC);

-- ─── 2) 게시판 쓰기 권한 조회 헬퍼 ───────────────────────
CREATE OR REPLACE FUNCTION public.community_board_write_role(p_program_id UUID, p_board_id TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT b->>'writePerm'
     FROM public.programs p
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.community_settings->'boards', '[]'::jsonb)) AS b
     WHERE p.id = p_program_id AND b->>'id' = p_board_id
     LIMIT 1),
    'free'
  );
$$;
GRANT EXECUTE ON FUNCTION public.community_board_write_role(UUID, TEXT) TO authenticated;

-- ─── 3) 작성 시 status 자동 결정 (approval → pending) ─────
CREATE OR REPLACE FUNCTION public.community_post_set_status()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_role TEXT;
BEGIN
  SELECT (p.owner_id = NEW.author_id) INTO v_is_owner FROM public.programs p WHERE p.id = NEW.program_id;
  v_role := public.community_board_write_role(NEW.program_id, NEW.board_id);
  IF v_role = 'approval' AND COALESCE(v_is_owner, false) = false THEN
    NEW.status := 'pending';
  ELSE
    NEW.status := 'visible';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_post_status ON public.community_posts;
CREATE TRIGGER community_post_status
  BEFORE INSERT ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.community_post_set_status();

-- ─── 4) RLS ──────────────────────────────────────────────
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

-- 읽기: 작성자 본인 / 운영자(전체) / 참여자(visible 만)
DROP POLICY IF EXISTS "community_posts select" ON public.community_posts;
CREATE POLICY "community_posts select" ON public.community_posts
FOR SELECT TO authenticated
USING (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.owner_id = auth.uid())
  OR (status = 'visible' AND public._is_active_participant(program_id, auth.uid()))
);

-- 쓰기: 본인 글 + (운영자 OR (참여자 AND 게시판이 readonly 아님))
DROP POLICY IF EXISTS "community_posts insert" ON public.community_posts;
CREATE POLICY "community_posts insert" ON public.community_posts
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.owner_id = auth.uid())
    OR (
      public._is_active_participant(program_id, auth.uid())
      AND public.community_board_write_role(program_id, board_id) <> 'readonly'
    )
  )
);

-- 수정: 작성자 본인 / 운영자
DROP POLICY IF EXISTS "community_posts update" ON public.community_posts;
CREATE POLICY "community_posts update" ON public.community_posts
FOR UPDATE TO authenticated
USING (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.owner_id = auth.uid())
)
WITH CHECK (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.owner_id = auth.uid())
);

-- 삭제: 작성자 본인 / 운영자
DROP POLICY IF EXISTS "community_posts delete" ON public.community_posts;
CREATE POLICY "community_posts delete" ON public.community_posts
FOR DELETE TO authenticated
USING (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id AND p.owner_id = auth.uid())
);
