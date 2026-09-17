-- ============================================================
-- Rollback: 266 - 되돌리기
-- 작성일: 2026-09-17
-- 주의:
--   ① 를 되돌리면 건강정보 동의 모달이 «매번 다시 뜨는» 라이브 결함이 되살아난다. 되돌릴 이유가 거의 없다.
--   ② 를 되돌리면 「피드에 보이지 않기」 선택과 신고 자동 숨김이 다시 서버에서 무시된다(사진 포함).
--   ③ 을 되돌리면 작성자가 자기 글의 status 를 visible 로 되돌려 신고 숨김·승인 검토를 우회할 수 있다.
--   정상 경로가 막히는 회귀가 확인됐을 때만 해당 항목만 골라 되돌리고, 원인을 고친 뒤 재적용할 것.
-- ============================================================

-- ─── ③ 되돌리기 ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS community_post_guard_status ON public.community_posts;
DROP FUNCTION IF EXISTS public.community_post_guard_status();

-- ─── ② 되돌리기 (037 원본 / 088 원본) ───────────────────────
DROP POLICY IF EXISTS "feed view approved verifications by program peers" ON public.verifications;
CREATE POLICY "feed view approved verifications by program peers"
ON public.verifications
FOR SELECT
TO authenticated
USING (
  status = 'APPROVED'
  AND mission_id IN (
    SELECT m.id FROM public.missions m
    JOIN public.programs p ON p.id = m.program_id
    JOIN public.program_participants pp ON pp.program_id = p.id
    WHERE p.feed_enabled = true
      AND pp.user_id = auth.uid()
      AND pp.status = 'ACTIVE'
  )
);

DROP POLICY IF EXISTS "public viewer view approved verifications" ON public.verifications;
CREATE POLICY "public viewer view approved verifications"
ON public.verifications
FOR SELECT
TO authenticated
USING (
  status = 'APPROVED'
  AND mission_id IN (
    SELECT m.id FROM public.missions m
    JOIN public.programs p ON p.id = m.program_id
    WHERE p.preview_enabled = true
      AND p.status = 'PUBLISHED'
      AND p.feed_enabled = true
  )
);

-- ─── ① 되돌리기 ─────────────────────────────────────────────
-- REVOKE SELECT (agreed_health_at) ON public.users FROM authenticated;
--   ⚠️ 주석 처리해 둔다 — 이걸 실행하면 동의 게이트가 다시 깨진다. 정말 필요할 때만 수동으로.
