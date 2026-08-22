-- ============================================================
-- Migration: 239 - 예정(시작 전) 프로그램 참여자 쓰기 잠금 (DB 강제)
-- 작성일: 2026-08-22
-- 설명:
--   예정 프로그램(status=PUBLISHED, start_date 가 오늘보다 미래)에서 참여자의 활동 쓰기를
--   DB 레벨에서 막는다. 지금까지는 클라이언트 게이팅만 있어 우회 가능했음(뒷문).
--     차단 대상(참여자 활동): 미션 인증(verifications) · 퀴즈 제출(quiz_submissions) ·
--       커뮤니티 글(community_posts) · 댓글(community_post_comments) · 좋아요(community_post_likes)
--   ⚠️ 종료(190)와 달리 예정은 「운영자(소유자)는 예외」 — 시작 전 미션/공지 등 콘텐츠 준비를
--      해야 하므로. 관리자(is_admin)·서비스롤(auth.uid() NULL)도 예외.
--
--   "예정" 정의(앱 isUpcomingByStartDate 와 동일): status='PUBLISHED' AND start_date 존재 AND
--     start_date > (now() AT TIME ZONE 'Asia/Seoul')::date   (시작일 전).
--
--   방식: 190(종료)과 동일하게 BEFORE INSERT/UPDATE/DELETE 트리거 + program_id 해석.
--     190 의 종료 트리거(trg_guard_ended)와 별개 이름(trg_guard_upcoming)이라 공존한다.
--   보너스: 190 이 누락한 quiz_submissions 의 「종료」 차단도 여기서 함께 보강(종료+예정 동시).
--
-- 하위호환: 활성(진행 중) 프로그램엔 무영향(가드 즉시 통과). 새 함수/트리거만 추가.
-- 복구:
--   각 테이블 trg_guard_upcoming 트리거 + trg_guard_qsub DROP, 아래 함수 DROP.
-- ============================================================

-- ── 예정 판정 ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._is_program_upcoming(p_program UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_start DATE; v_status TEXT;
BEGIN
  IF p_program IS NULL THEN RETURN FALSE; END IF;
  SELECT start_date, status INTO v_start, v_status FROM public.programs WHERE id = p_program;
  RETURN v_status = 'PUBLISHED' AND v_start IS NOT NULL
     AND v_start > (now() AT TIME ZONE 'Asia/Seoul')::date;
END;
$$;

-- ── 가드: 예정 + 비운영자 + 비관리자 + 사용자 컨텍스트면 예외 ──
CREATE OR REPLACE FUNCTION public._block_if_upcoming(p_program UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;            -- 서비스롤/시스템
  IF public.is_admin() THEN RETURN; END IF;             -- 관리자 예외
  -- 운영자(소유자)는 예정에도 준비/테스트 허용
  IF EXISTS (SELECT 1 FROM public.programs WHERE id = p_program AND owner_id = auth.uid()) THEN
    RETURN;
  END IF;
  IF public._is_program_upcoming(p_program) THEN
    RAISE EXCEPTION '아직 시작 전이에요. 시작일부터 참여할 수 있어요'
      USING ERRCODE = 'P0001', HINT = 'program_upcoming';
  END IF;
END;
$$;

-- ── 트리거 함수(program_id 해석 방식별) — 예정 전용 ────────
-- 1) 직접 program_id: community_posts
CREATE OR REPLACE FUNCTION public._guard_upcoming_direct()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._block_if_upcoming(COALESCE(NEW.program_id, OLD.program_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2) mission_id → missions.program_id : verifications
CREATE OR REPLACE FUNCTION public._guard_upcoming_via_mission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prog UUID;
BEGIN
  SELECT program_id INTO v_prog FROM public.missions WHERE id = COALESCE(NEW.mission_id, OLD.mission_id);
  PERFORM public._block_if_upcoming(v_prog);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3) post_id → community_posts.program_id : community_post_comments, community_post_likes
CREATE OR REPLACE FUNCTION public._guard_upcoming_via_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prog UUID;
BEGIN
  SELECT program_id INTO v_prog FROM public.community_posts WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  PERFORM public._block_if_upcoming(v_prog);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4) quiz_id → quizzes.program_id : quiz_submissions (예정 + 종료 동시 — 190 누락 보강)
CREATE OR REPLACE FUNCTION public._guard_qsub()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prog UUID;
BEGIN
  SELECT program_id INTO v_prog FROM public.quizzes WHERE id = COALESCE(NEW.quiz_id, OLD.quiz_id);
  PERFORM public._block_if_ended(v_prog);     -- 종료: 운영자 포함 조회전용
  PERFORM public._block_if_upcoming(v_prog);  -- 예정: 참여자만 차단(운영자 테스트 허용)
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── 트리거 부착 (예정) ────────────────────────────────────
DROP TRIGGER IF EXISTS trg_guard_upcoming ON public.verifications;
CREATE TRIGGER trg_guard_upcoming BEFORE INSERT OR UPDATE OR DELETE ON public.verifications
  FOR EACH ROW EXECUTE FUNCTION public._guard_upcoming_via_mission();

DROP TRIGGER IF EXISTS trg_guard_upcoming ON public.community_posts;
CREATE TRIGGER trg_guard_upcoming BEFORE INSERT OR UPDATE OR DELETE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public._guard_upcoming_direct();

DROP TRIGGER IF EXISTS trg_guard_upcoming ON public.community_post_comments;
CREATE TRIGGER trg_guard_upcoming BEFORE INSERT OR UPDATE OR DELETE ON public.community_post_comments
  FOR EACH ROW EXECUTE FUNCTION public._guard_upcoming_via_post();

DROP TRIGGER IF EXISTS trg_guard_upcoming ON public.community_post_likes;
CREATE TRIGGER trg_guard_upcoming BEFORE INSERT OR UPDATE OR DELETE ON public.community_post_likes
  FOR EACH ROW EXECUTE FUNCTION public._guard_upcoming_via_post();

-- ── quiz_submissions: 예정 + 종료 동시 가드 ───────────────
DROP TRIGGER IF EXISTS trg_guard_qsub ON public.quiz_submissions;
CREATE TRIGGER trg_guard_qsub BEFORE INSERT OR UPDATE OR DELETE ON public.quiz_submissions
  FOR EACH ROW EXECUTE FUNCTION public._guard_qsub();
