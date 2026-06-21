-- ============================================================
-- Migration: 104 - 커뮤니티 게시판 글 상단 고정 (community_posts.pinned_at)
-- 작성일: 2026-06-22
-- 설명:
--   운영자가 게시판(주로 공지) 글을 상단에 고정할 수 있게 pinned_at 컬럼 추가.
--   - pinned_at NULL  = 고정 안 됨 (기본)
--   - pinned_at 값     = 고정 (조회 시 고정 글 먼저, 같은 고정끼리 최근 고정순)
--   고정/해제는 **프로그램 owner 만** 가능. 참여자가 자기 글을 수정(096 UPDATE RLS:
--   author 본인 허용)할 때 pinned_at 을 임의로 바꾸지 못하도록 BEFORE UPDATE 트리거로
--   owner 가 아니면 pinned_at 변경을 무효화(OLD 값 유지)한다.
--
--   기존 community_post_set_status (BEFORE INSERT) 와는 이벤트가 달라 공존.
--   하위호환: 컬럼 nullable·기존 행 NULL. pinned_at 를 모르는 기존 코드는 그대로 동작.
--   단, 이 마이그레이션을 **프로드에 먼저 적용**해야 pinned_at 정렬을 쓰는 새 코드가 동작함.
--
-- 복구:
--   DROP TRIGGER IF EXISTS community_post_guard_pin ON public.community_posts;
--   DROP FUNCTION IF EXISTS public.community_post_guard_pin();
--   DROP INDEX IF EXISTS public.idx_community_posts_pinned;
--   ALTER TABLE public.community_posts DROP COLUMN IF EXISTS pinned_at;
-- ============================================================

-- ─── 1) 컬럼 ─────────────────────────────────────────────
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

-- ─── 2) 정렬용 인덱스 (고정 먼저 → 최신순) ───────────────
CREATE INDEX IF NOT EXISTS idx_community_posts_pinned
  ON public.community_posts(program_id, board_id, pinned_at DESC NULLS LAST, created_at DESC);

-- ─── 3) 고정값 변경 가드 — owner 만 pinned_at 변경 가능 ───
CREATE OR REPLACE FUNCTION public.community_post_guard_pin()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_owner BOOLEAN;
BEGIN
  IF NEW.pinned_at IS DISTINCT FROM OLD.pinned_at THEN
    SELECT (p.owner_id = auth.uid()) INTO v_is_owner
    FROM public.programs p WHERE p.id = NEW.program_id;
    -- 운영자가 아니면 고정값 변경 무효화 (그 외 필드 수정은 그대로 허용)
    IF COALESCE(v_is_owner, false) = false THEN
      NEW.pinned_at := OLD.pinned_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_post_guard_pin ON public.community_posts;
CREATE TRIGGER community_post_guard_pin
  BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.community_post_guard_pin();
