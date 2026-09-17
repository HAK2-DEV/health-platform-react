-- ============================================================
-- Migration: 265 - program_participants 쓰기 강화 (자가 가입·셀프 승인·강퇴 복귀 차단)
-- 작성일: 2026-09-17
-- 설명:
--   보안 감사(2026-09-17)에서 확인된 구멍. 015 의 INSERT 정책이 `user_id = auth.uid()` 만 검사해서,
--   로그인한 아무 사용자나 REST 로 program_participants 에 직접 INSERT 하면
--   초대코드·승인·비공개·PUBLISHED 여부와 무관하게 «아무 프로그램에나 ACTIVE 참여자» 가 됐다.
--   ACTIVE 가 되면 그 프로그램의 미션·다른 참여자 인증 사진(스토리지 위임 정책 경유)·게시글·랭킹이
--   전부 열린다. UPDATE 정책은 WITH CHECK 가 없어 USING 이 재사용되므로 본인 행의 status 를
--   PENDING→ACTIVE(셀프 승인), LEFT→ACTIVE(강퇴 복귀) 로 바꾸는 것도 막히지 않았다.
--
--   초대코드 가입 RPC(053·068·089·123)는 SECURITY DEFINER 라 RLS 를 거치지 않는다 — 정문은 튼튼했고
--   이 정책이 뒷문이었다. 여기서는 뒷문만 닫는다.
--
-- 정상 경로(클라이언트가 테이블에 직접 쓰는 곳 — 전수 확인, 전부 그대로 통과):
--   ① 공개 프로그램 참여 upsert (ProgramDetailModal): FREE→ACTIVE / APPROVAL→PENDING
--   ② 본인 탈퇴 (ProgramDetailPage): status='LEFT'
--   ③ 본인 growth_state·entry_answer·left_at 갱신 (status 변경 없음)
--   ④ 운영자 승인·거절·재참여 복구 (OperatorTodayPage/ProgramStatsUsersPage/ParticipantApprovalModal)
--   ⑤ RPC (초대코드 가입·내보내기·식단 목표·목표 체중) — current_user='postgres' 로 통과
--
-- 방식:
--   1) INSERT 정책 교체 — 「보이는 프로그램에, 참여 방식에 맞는 status 로만」.
--      EXISTS(programs …) 는 호출자의 programs SELECT 정책(054+237) 아래에서 평가되므로
--      안 보이는 프로그램(비공개·미참여)에는 자동으로 못 들어온다. INVITE_CODE 는 직접 INSERT 불가.
--   2) BEFORE UPDATE 트리거 — 104 의 pinned_at 가드와 같은 패턴. 운영자·관리자·RPC 는 통과,
--      본인 경로는 program_id/user_id/joined_at/completed_at 고정 + status 는
--      「→LEFT」「공개 FREE 재참여(→ACTIVE)」「APPROVAL 재신청(→PENDING)」만 허용.
--      ⚠️ 트리거 함수는 SECURITY INVOKER 여야 한다 — DEFINER 로 만들면 그 안에서 current_user 가
--      항상 postgres 가 되어 「REST 직접 쓰기 vs RPC」 판별이 무너진다.
--   SELECT/UPDATE/DELETE 정책과 클라이언트 코드는 손대지 않는다.
--
-- 하위호환: 정상 경로 ①~⑤ 모두 기존 동작 유지. 막히는 것은 «정책이 의도하지 않았던 쓰기» 뿐.
--   INSERT ... ON CONFLICT DO UPDATE(upsert) 의 충돌 경로는 INSERT 정책이 아니라 UPDATE 정책만
--   타므로, 재참여 규칙은 트리거가 따로 지킨다.
--
-- 범위 밖(후속): 정원(max_participants) 초과 직접 INSERT 는 여전히 검사하지 않는다.
--
-- 복구:
--   supabase/rollbacks/265_revert_participants_write_hardening.sql
-- ============================================================

-- ─── 1) INSERT 정책 교체 ───────────────────────────────────
DROP POLICY IF EXISTS "users can join programs" ON public.program_participants;

CREATE POLICY "users can join programs"
ON public.program_participants
FOR INSERT
TO authenticated
WITH CHECK (
  program_participants.user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.programs p                      -- 호출자의 programs RLS 적용 → 안 보이면 false
    WHERE p.id = program_participants.program_id
      AND p.status = 'PUBLISHED'
      AND (
        (COALESCE(p.join_type, 'FREE') = 'FREE' AND program_participants.status = 'ACTIVE')
        OR (p.join_type = 'APPROVAL'            AND program_participants.status = 'PENDING')
        -- INVITE_CODE: 직접 INSERT 불가 — join_by_invite_code RPC(SECURITY DEFINER) 만
      )
  )
);

-- ─── 2) 본인 UPDATE 가드 트리거 ──────────────────────────────
CREATE OR REPLACE FUNCTION public.program_participant_guard_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_owner       UUID;
  v_join_type   TEXT;
  v_prog_status TEXT;
BEGIN
  -- 신뢰 경로 통과: SECURITY DEFINER RPC 안(postgres)·service_role·SQL Editor.
  -- REST 로 직접 쓰는 일반 사용자만 current_user = 'authenticated'.
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- INVOKER 라 호출자의 programs RLS 가 적용된다: 안 보이는 프로그램이면 세 값 모두 NULL.
  SELECT p.owner_id, p.join_type, p.status
    INTO v_owner, v_join_type, v_prog_status
  FROM public.programs p
  WHERE p.id = OLD.program_id;

  -- 운영자: 승인·거절·재참여 복구·내보내기 전부 허용 (기존 UPDATE 정책 그대로)
  IF v_owner IS NOT NULL AND v_owner = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- ── 여기부터 «참여자 본인» 경로 ──
  IF NEW.program_id <> OLD.program_id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION '참여 정보의 프로그램·사용자는 바꿀 수 없어요'
      USING ERRCODE = '42501';
  END IF;
  NEW.joined_at    := OLD.joined_at;
  NEW.completed_at := OLD.completed_at;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'LEFT' THEN
      NULL;   -- 본인 탈퇴
    ELSIF NEW.status = 'ACTIVE'
      AND v_prog_status = 'PUBLISHED'
      AND COALESCE(v_join_type, 'FREE') = 'FREE' THEN
      NULL;   -- 공개(FREE) 프로그램 재참여 — upsert 충돌 경로
    ELSIF NEW.status = 'PENDING'
      AND v_prog_status = 'PUBLISHED'
      AND v_join_type = 'APPROVAL'
      AND OLD.status IN ('LEFT', 'REJECTED', 'COMPLETED') THEN
      NULL;   -- 승인제 재신청
    ELSE
      -- PENDING→ACTIVE 셀프 승인, 강퇴(LEFT)→ACTIVE 복귀, 초대코드 프로그램 복귀,
      -- 안 보이는(비공개) 프로그램 복귀 등은 여기서 거부
      RAISE EXCEPTION '참여 상태는 운영자만 바꿀 수 있어요'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS program_participant_guard_update ON public.program_participants;
CREATE TRIGGER program_participant_guard_update
  BEFORE UPDATE ON public.program_participants
  FOR EACH ROW EXECUTE FUNCTION public.program_participant_guard_update();
