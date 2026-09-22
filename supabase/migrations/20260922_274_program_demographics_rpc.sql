-- ============================================================
-- Migration: 274 - 성별·연령대를 «전 회원 열람» 에서 «해당 프로그램 운영자» 로 좁힘
-- 작성일: 2026-09-22
-- 설명:
--   public.users 의 RLS SELECT 정책은 `USING (true)` — 로그인한 누구나 전 회원 행을
--   읽는다. 240 이 email 만 컬럼 단위로 막았고, gender·age_range 는 열려 있다.
--   즉 **아무 로그인 사용자나 전 회원의 성별·연령대를 수집**할 수 있었다.
--
--   쓰는 곳은 운영자 화면 두 곳뿐이다(형평성 분해):
--     ProgramEndReportPage(엑셀 내보내기) · ProgramStatsSurveyPage
--   둘 다 «자기 프로그램» 참여자에 대해서만 필요하다.
--   → 컬럼 열람을 회수하고, 운영자 전용 RPC 로 그 프로그램 참여자만 돌려준다.
--
--   ⚠️ 270 이후 규칙: 새 함수는 anon 에 부여하지 않는다(기본 권한에서 이미 제외되지만 명시).
--
-- 영향:
--   · users.gender / users.age_range 직접 SELECT 는 42501 → **클라이언트 코드 변경이 함께 가야 한다.**
--     (같은 푸시에 포함. 마이그레이션을 먼저 올리면 그 두 화면의 형평성 분해만 빈 값이 된다 —
--      화면이 죽지는 않는다. fetch 실패는 catch 로 {} 폴백.)
--   · 본인 값 조회 경로는 코드에 없다(입력만 한다) — 확인함.
--   · 리포트·설문 RPC 등 SECURITY DEFINER 경로는 영향 없음.
--
-- 복구: supabase/rollbacks/274_revert_program_demographics_rpc.sql
-- ============================================================

-- ── 1) 운영자 전용 조회 ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_program_demographics(p_program_id UUID)
RETURNS TABLE (user_id UUID, gender TEXT, age_range TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT u.id, u.gender, u.age_range
  FROM public.program_participants pp
  JOIN public.users u ON u.id = pp.user_id
  WHERE pp.program_id = p_program_id
    AND EXISTS (                                   -- 그 프로그램 운영자 본인 or 관리자
      SELECT 1 FROM public.programs p
      WHERE p.id = p_program_id
        AND (p.owner_id = auth.uid() OR public.is_admin())
    );
$fn$;

REVOKE EXECUTE ON FUNCTION public.get_program_demographics(UUID) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_program_demographics(UUID) TO authenticated;

-- ── 2) 직접 열람 회수 ────────────────────────────────────
REVOKE SELECT (gender, age_range) ON public.users FROM authenticated, anon;

-- 확인용:
--   SELECT privilege_type, string_agg(column_name, ', ' ORDER BY column_name)
--   FROM information_schema.column_privileges
--   WHERE table_schema='public' AND table_name='users' AND grantee='authenticated'
--   GROUP BY 1;
--   → SELECT 행에 gender·age_range 가 없어야 한다.
