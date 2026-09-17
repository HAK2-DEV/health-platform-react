-- ============================================================
-- Migration: 266 - 동의 컬럼 GRANT + 피드 비공개 실효화 + 게시글 status 가드
-- 작성일: 2026-09-17
-- 설명:
--   2026-09-17 보안 감사의 🔴 나머지 3건. 셋 다 «덧붙이기/좁히기» 라 클라이언트 코드 변경이 없다.
--
--   ① users.agreed_health_at 에 SELECT GRANT 누락 (라이브 결함)
--      240 이 users 를 «컬럼 목록» SELECT 모델로 바꿨는데 261 이 컬럼만 추가하고 GRANT 를 빠뜨렸다.
--      실측(information_schema.column_privileges): agreed_health_at 은 INSERT/UPDATE 만 있고 SELECT 없음.
--      → lib/healthConsent.fetchHealthConsent 의 select('agreed_health_at') 가 42501 로 죽고,
--        HealthConsentContext 의 agreed 가 늘 false → 민감정보 동의 모달이 «매번» 다시 뜬다.
--        저장(UPDATE)은 되므로 동의 증적 자체는 온전하다. 읽기만 복구하면 된다.
--      ⚠️ 앞으로 users 에 컬럼 추가 시 GRANT SELECT (컬럼) 을 반드시 같이 넣을 것.
--
--   ② verifications.feed_visible 이 RLS 에서 검사되지 않음
--      「이 인증을 피드에 보이지 않기」(039) 와 신고 누적 자동 숨김(report_auto_hide 가
--      feed_visible=false 로 표시)이 **클라이언트 필터에만** 존재했다. 같은 프로그램 참여자가
--      REST 로 feed_visible 필터 없이 조회하면 행이 그대로 오고, 스토리지 위임 정책(048/117)을
--      타고 **사진 파일까지** 열린다. 체중·식단·금연 프로그램의 비공개 선택 사진이 여기 해당.
--      → 피어 피드(037)·미리보기(088) 두 SELECT 정책에 AND feed_visible = true 를 더한다.
--      본인 글·운영자(018)·관리자 정책은 그대로 — 작성자와 운영자는 숨겨진 것도 계속 봐야 한다.
--      (087 은 088 이 이미 대체했으므로 대상이 아니다.)
--
--   ③ community_posts.status 를 작성자가 직접 되돌릴 수 있음
--      096 UPDATE 정책이 author_id = auth.uid() 만 검사하고, status 를 지키는 트리거가 없었다.
--      PATCH {"status":"visible"} 한 번으로 (a) 신고로 숨겨진 자기 글 무한 복구
--      (b) 승인제 게시판의 pending 글 셀프 승인 → 운영자 검토 큐 우회.
--      작성 시점은 BEFORE INSERT 트리거(096)가 status 를 강제하므로 INSERT 는 안전했다.
--      → 104 의 pinned_at 가드와 «같은 패턴» 의 BEFORE UPDATE 트리거로 막는다.
--      인증(verifications)은 018 UPDATE 가 이미 운영자 전용이라 같은 문제가 없다 — 그 대칭을 맞추는 것.
--
-- 통과해야 하는 정상 경로 (전수 확인):
--   · 운영자 숨김/승인: queries.js:1971 setCommunityPostStatus — authenticated + owner 로 직접 UPDATE → owner 분기 통과
--   · 신고 자동 숨김: report_auto_hide (SECURITY DEFINER → current_user='postgres') → 신뢰 경로 통과
--   · 거절 RPC: reject_community_post (110, DEFINER) → 신뢰 경로 통과
--   · 작성자 글 수정: queries.js:1700 updateCommunityPost — title/body/image_path/board_id 만, status 미포함 → 영향 없음
--   · 고정/해제: queries.js:1720 togglePin — pinned_at 만, 104 가드와 공존(트리거 이름 순서상 pin 가드가 먼저)
--
-- 방식 주의:
--   ⚠️ 트리거 함수는 SECURITY INVOKER 여야 한다(265 에서 배움). DEFINER 로 만들면 그 안에서
--      current_user 가 항상 postgres 가 되어 「REST 직접 쓰기 vs DEFINER RPC」 판별이 무너진다.
--   ⚠️ 거부는 RAISE 가 아니라 «조용히 OLD 값으로 되돌리기» — 104 와 동일. 정상 편집 요청이
--      status 를 실수로 실어 보내도 에러 없이 나머지 필드만 반영된다(하위호환 우선).
--
-- 하위호환: ① 권한을 넓히기만 함 ② 이미 클라가 걸던 필터를 서버가 강제할 뿐 ③ 정상 경로 전부 통과.
--
-- 범위 밖(후속): users 의 테이블 전체 UPDATE 회수(role·email·created_at), 037/088 외 멤버십 프로빙,
--   community_posts 의 board_id 를 «없는 게시판» 으로 옮기는 경우(노출은 안 되나 정리 대상).
--
-- 복구:
--   supabase/rollbacks/266_revert_consent_grant_feed_visible_post_status.sql
-- ============================================================

-- ─── ① 민감정보 동의 컬럼 읽기 권한 ──────────────────────────
GRANT SELECT (agreed_health_at) ON public.users TO authenticated;

-- ─── ② verifications 피드 SELECT 두 정책에 feed_visible 반영 ──

-- 037: 같은 프로그램 ACTIVE 참여자끼리 서로의 APPROVED 인증 열람
DROP POLICY IF EXISTS "feed view approved verifications by program peers" ON public.verifications;
CREATE POLICY "feed view approved verifications by program peers"
ON public.verifications
FOR SELECT
TO authenticated
USING (
  status = 'APPROVED'
  AND feed_visible = true                      -- 266: 본인 비공개 선택·신고 자동 숨김 존중
  AND mission_id IN (
    SELECT m.id FROM public.missions m
    JOIN public.programs p ON p.id = m.program_id
    JOIN public.program_participants pp ON pp.program_id = p.id
    WHERE p.feed_enabled = true
      AND pp.user_id = auth.uid()
      AND pp.status = 'ACTIVE'
  )
);

-- 088: 미리보기(preview_enabled) 프로그램의 비참여자 열람
DROP POLICY IF EXISTS "public viewer view approved verifications" ON public.verifications;
CREATE POLICY "public viewer view approved verifications"
ON public.verifications
FOR SELECT
TO authenticated
USING (
  status = 'APPROVED'
  AND feed_visible = true                      -- 266
  AND mission_id IN (
    SELECT m.id FROM public.missions m
    JOIN public.programs p ON p.id = m.program_id
    WHERE p.preview_enabled = true
      AND p.status = 'PUBLISHED'
      AND p.feed_enabled = true
  )
);

-- ─── ③ community_posts status 가드 ──────────────────────────
CREATE OR REPLACE FUNCTION public.community_post_guard_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_is_owner BOOLEAN;
BEGIN
  -- 신뢰 경로: SECURITY DEFINER 트리거·RPC(report_auto_hide, reject_community_post),
  -- service_role, SQL Editor. REST 로 직접 쓰는 일반 사용자만 current_user='authenticated'.
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  SELECT (p.owner_id = auth.uid()) INTO v_is_owner
  FROM public.programs p WHERE p.id = NEW.program_id;

  -- 운영자: 숨김·복구·승인 모두 허용 (queries.js setCommunityPostStatus 경로)
  IF COALESCE(v_is_owner, false) THEN
    RETURN NEW;
  END IF;

  -- ── 작성자/참여자 경로: 신뢰 기반 필드를 조용히 원복 (104 pinned_at 가드와 동일) ──
  NEW.status     := OLD.status;       -- 신고 숨김 해제·셀프 승인 차단
  NEW.program_id := OLD.program_id;   -- 다른 프로그램으로 이동 차단
  NEW.author_id  := OLD.author_id;

  -- 게시판 이동은 허용하되, 운영자 전용(readonly) 게시판으로는 못 옮긴다
  IF NEW.board_id IS DISTINCT FROM OLD.board_id
     AND public.community_board_write_role(NEW.program_id, NEW.board_id) = 'readonly' THEN
    NEW.board_id := OLD.board_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_post_guard_status ON public.community_posts;
CREATE TRIGGER community_post_guard_status
  BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.community_post_guard_status();
