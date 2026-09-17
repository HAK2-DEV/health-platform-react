-- ============================================================
-- Rollback: 265 - program_participants 쓰기 강화 되돌리기
-- 작성일: 2026-09-17
-- 주의:
--   되돌리면 015 원본 상태로 돌아간다 = 로그인한 아무 사용자나 아무 프로그램에 직접 INSERT 로
--   ACTIVE 참여자가 될 수 있고, 본인 행의 status 를 PENDING→ACTIVE / LEFT→ACTIVE 로 바꿀 수 있는
--   보안 구멍이 다시 열린다. 정상 경로가 막히는 회귀가 확인됐을 때만 쓰고, 원인을 고친 뒤 재적용할 것.
-- ============================================================

DROP TRIGGER IF EXISTS program_participant_guard_update ON public.program_participants;
DROP FUNCTION IF EXISTS public.program_participant_guard_update();

DROP POLICY IF EXISTS "users can join programs" ON public.program_participants;

-- 015 원본
CREATE POLICY "users can join programs"
ON public.program_participants
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
