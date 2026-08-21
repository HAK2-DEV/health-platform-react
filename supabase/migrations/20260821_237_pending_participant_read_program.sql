-- ============================================================
-- Migration: 237 - 승인 대기(PENDING) 참여자의 프로그램 열람 허용
-- 작성일: 2026-08-21
-- 설명:
--   승인제(초대코드+승인 / APPROVAL) 프로그램에 참여 신청하면
--   program_participants.status = 'PENDING' 으로 대기 상태가 된다.
--   대시보드 「참여중」 목록에 「대기중」 칩으로 노출하고, 클릭 시 둘러보기(열람 전용)를
--   할 수 있어야 하는데 — 현재 programs SELECT 정책(054)은
--     owner OR (PUBLISHED & is_public) OR _is_active_participant(ACTIVE)
--   만 허용해서 비공개 프로그램의 PENDING 신청자는 programs 행 자체를 못 읽는다.
--   → fetchPendingPrograms 의 programs!inner 조인이 비고, ProgramDetailPage 진입도 막힘.
--
--   해결: ACTIVE 헬퍼와 동일한 패턴으로 PENDING 판별 SECURITY DEFINER 헬퍼를 추가하고,
--   programs 에 "PENDING 신청자 열람" SELECT 정책을 OR 로 하나 더 얹는다(추가·하위호환).
--   기존 정책·쓰기 권한은 그대로 — 열람만 넓힌다. 쓰기(INSERT/UPDATE/DELETE)는 여전히
--   ACTIVE 참여자/운영자만 (클라이언트도 isViewer 로 쓰기 차단).
--
--   재귀 방지: 054 와 동일하게 SECURITY DEFINER 함수 안에서 program_participants 를
--   직접 조회(함수 내부는 RLS 미적용)해 programs↔participants 정책 상호참조를 피한다.
--
--   미션 목록도 둘러보기에서 보이도록 missions SELECT 에 PENDING 케이스를 OR 로 더한다
--   (056 이 ACTIVE 참여자를 넣은 것과 동일 패턴). 인증 제출 등 쓰기는 여전히 ACTIVE 만.
--
-- 복구:
--   DROP POLICY IF EXISTS "view program by pending participant" ON public.programs;
--   -- missions 정책은 056 원본으로 되돌리려면 아래 재생성(PENDING OR 제거):
--   --   DROP POLICY ... ; CREATE POLICY ... (056 내용)
--   DROP FUNCTION IF EXISTS public._is_pending_participant(UUID, UUID);
-- ============================================================

-- ─── 1) SECURITY DEFINER 헬퍼 (PENDING 판별) ───────────────
CREATE OR REPLACE FUNCTION public._is_pending_participant(
  p_program_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.program_participants
    WHERE program_id = p_program_id
      AND user_id = p_user_id
      AND status = 'PENDING'
  );
$$;

GRANT EXECUTE ON FUNCTION public._is_pending_participant(UUID, UUID) TO authenticated;

-- ─── 2) programs SELECT 정책 추가 (PENDING 신청자 열람) ────
DROP POLICY IF EXISTS "view program by pending participant" ON public.programs;

CREATE POLICY "view program by pending participant"
ON public.programs
FOR SELECT
TO authenticated
USING (
  public._is_pending_participant(id, auth.uid())
);

-- ─── 3) missions SELECT 정책 — PENDING 신청자 열람 추가 ────
--   056 정책을 재작성(기존 조건 유지 + PENDING OR 추가). 하위호환.
DROP POLICY IF EXISTS "view missions of accessible programs" ON public.missions;

CREATE POLICY "view missions of accessible programs"
ON public.missions
FOR SELECT
TO authenticated
USING (
  program_id IN (
    SELECT id FROM public.programs
    WHERE owner_id = auth.uid()
       OR (status = 'PUBLISHED' AND is_public = true)
  )
  OR public._is_active_participant(program_id, auth.uid())
  OR public._is_pending_participant(program_id, auth.uid())
);
