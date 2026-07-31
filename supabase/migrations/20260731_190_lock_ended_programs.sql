-- ============================================================
-- Migration: 190 - 종료된 프로그램 조회 전용 잠금 (관리자 제외)
-- 작성일: 2026-07-31
-- 설명:
--   종료(end_date 지난)된 프로그램은 운영자·참여자 모두 "조회만" 가능하게 DB에서 강제.
--   미션·퀴즈·문항·게시글·댓글·인증·클래스·좋아요 생성/수정/삭제 차단 + programs 수정 차단
--   (= 종료 기간 end_date 변경도 차단). 관리자(is_admin)·서비스롤(auth.uid() NULL)은 예외.
--
--   "종료" 정의(앱 progressUrgency 와 동일): end_date IS NOT NULL AND
--     (now() AT TIME ZONE 'Asia/Seoul')::date > end_date   (마지막 날 지난 뒤).
--
--   방식: 각 콘텐츠 테이블 BEFORE INSERT/UPDATE/DELETE 트리거 → program_id 해석 후
--         _block_if_ended() 가 종료면 예외. programs 는 BEFORE UPDATE 로 잠금.
--   (RLS 정책을 대량 수정하지 않고 트리거로 가드 → 기존 정책·활성 프로그램 동작 무영향.)
--
-- 하위호환: 활성 프로그램엔 무영향(가드가 즉시 통과). 새 트리거/함수만 추가.
-- 복구: 이 마이그의 트리거 DROP + 함수 DROP.
-- ============================================================

-- ── 종료 판정 ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._is_program_ended(p_program UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_end DATE;
BEGIN
  IF p_program IS NULL THEN RETURN FALSE; END IF;
  SELECT end_date INTO v_end FROM public.programs WHERE id = p_program;
  RETURN v_end IS NOT NULL AND (now() AT TIME ZONE 'Asia/Seoul')::date > v_end;
END;
$$;

-- ── 가드: 종료 + 비관리자 + 사용자 컨텍스트면 예외 ─────────
CREATE OR REPLACE FUNCTION public._block_if_ended(p_program UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;          -- 서비스롤/시스템 컨텍스트 허용
  IF public.is_admin() THEN RETURN; END IF;            -- 관리자 예외
  IF public._is_program_ended(p_program) THEN
    RAISE EXCEPTION '종료된 프로그램은 조회만 가능해요'
      USING ERRCODE = 'P0001', HINT = 'program_ended';
  END IF;
END;
$$;

-- ── 트리거 함수(program_id 해석 방식별) ───────────────────
-- 1) 직접 program_id: missions, quizzes, community_posts, sessions
CREATE OR REPLACE FUNCTION public._guard_ended_direct()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._block_if_ended(COALESCE(NEW.program_id, OLD.program_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2) quiz_id → quizzes.program_id : quiz_questions
CREATE OR REPLACE FUNCTION public._guard_ended_via_quiz()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prog UUID;
BEGIN
  SELECT program_id INTO v_prog FROM public.quizzes WHERE id = COALESCE(NEW.quiz_id, OLD.quiz_id);
  PERFORM public._block_if_ended(v_prog);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3) mission_id → missions.program_id : verifications
CREATE OR REPLACE FUNCTION public._guard_ended_via_mission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prog UUID;
BEGIN
  SELECT program_id INTO v_prog FROM public.missions WHERE id = COALESCE(NEW.mission_id, OLD.mission_id);
  PERFORM public._block_if_ended(v_prog);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4) post_id → community_posts.program_id : community_post_comments, community_post_likes
CREATE OR REPLACE FUNCTION public._guard_ended_via_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prog UUID;
BEGIN
  SELECT program_id INTO v_prog FROM public.community_posts WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  PERFORM public._block_if_ended(v_prog);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 5) verification_id → verifications→missions.program_id : post_comments, post_likes
CREATE OR REPLACE FUNCTION public._guard_ended_via_verif()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prog UUID;
BEGIN
  SELECT m.program_id INTO v_prog
  FROM public.verifications v JOIN public.missions m ON m.id = v.mission_id
  WHERE v.id = COALESCE(NEW.verification_id, OLD.verification_id);
  PERFORM public._block_if_ended(v_prog);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 6) comment_id → post_comments→verif→mission : post_comment_likes
CREATE OR REPLACE FUNCTION public._guard_ended_via_pcomment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prog UUID;
BEGIN
  SELECT m.program_id INTO v_prog
  FROM public.post_comments c
  JOIN public.verifications v ON v.id = c.verification_id
  JOIN public.missions m ON m.id = v.mission_id
  WHERE c.id = COALESCE(NEW.comment_id, OLD.comment_id);
  PERFORM public._block_if_ended(v_prog);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 7) comment_id → community_post_comments→community_posts : community_post_comment_likes
CREATE OR REPLACE FUNCTION public._guard_ended_via_ccomment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prog UUID;
BEGIN
  SELECT cp.program_id INTO v_prog
  FROM public.community_post_comments c
  JOIN public.community_posts cp ON cp.id = c.post_id
  WHERE c.id = COALESCE(NEW.comment_id, OLD.comment_id);
  PERFORM public._block_if_ended(v_prog);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 8) programs: 종료면 수정 자체 차단 (종료 기간 변경 포함)
CREATE OR REPLACE FUNCTION public._guard_ended_programs()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.is_admin() THEN RETURN NEW; END IF;
  IF OLD.end_date IS NOT NULL
     AND (now() AT TIME ZONE 'Asia/Seoul')::date > OLD.end_date THEN
    RAISE EXCEPTION '종료된 프로그램은 수정할 수 없어요'
      USING ERRCODE = 'P0001', HINT = 'program_ended';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 트리거 부착 ───────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_guard_ended ON public.missions;
CREATE TRIGGER trg_guard_ended BEFORE INSERT OR UPDATE OR DELETE ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public._guard_ended_direct();

DROP TRIGGER IF EXISTS trg_guard_ended ON public.quizzes;
CREATE TRIGGER trg_guard_ended BEFORE INSERT OR UPDATE OR DELETE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public._guard_ended_direct();

DROP TRIGGER IF EXISTS trg_guard_ended ON public.community_posts;
CREATE TRIGGER trg_guard_ended BEFORE INSERT OR UPDATE OR DELETE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public._guard_ended_direct();

DROP TRIGGER IF EXISTS trg_guard_ended ON public.sessions;
CREATE TRIGGER trg_guard_ended BEFORE INSERT OR UPDATE OR DELETE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public._guard_ended_direct();

DROP TRIGGER IF EXISTS trg_guard_ended ON public.quiz_questions;
CREATE TRIGGER trg_guard_ended BEFORE INSERT OR UPDATE OR DELETE ON public.quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public._guard_ended_via_quiz();

DROP TRIGGER IF EXISTS trg_guard_ended ON public.verifications;
CREATE TRIGGER trg_guard_ended BEFORE INSERT OR UPDATE OR DELETE ON public.verifications
  FOR EACH ROW EXECUTE FUNCTION public._guard_ended_via_mission();

DROP TRIGGER IF EXISTS trg_guard_ended ON public.community_post_comments;
CREATE TRIGGER trg_guard_ended BEFORE INSERT OR UPDATE OR DELETE ON public.community_post_comments
  FOR EACH ROW EXECUTE FUNCTION public._guard_ended_via_post();

DROP TRIGGER IF EXISTS trg_guard_ended ON public.community_post_likes;
CREATE TRIGGER trg_guard_ended BEFORE INSERT OR UPDATE OR DELETE ON public.community_post_likes
  FOR EACH ROW EXECUTE FUNCTION public._guard_ended_via_post();

DROP TRIGGER IF EXISTS trg_guard_ended ON public.post_comments;
CREATE TRIGGER trg_guard_ended BEFORE INSERT OR UPDATE OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public._guard_ended_via_verif();

DROP TRIGGER IF EXISTS trg_guard_ended ON public.post_likes;
CREATE TRIGGER trg_guard_ended BEFORE INSERT OR UPDATE OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public._guard_ended_via_verif();

DROP TRIGGER IF EXISTS trg_guard_ended ON public.post_comment_likes;
CREATE TRIGGER trg_guard_ended BEFORE INSERT OR UPDATE OR DELETE ON public.post_comment_likes
  FOR EACH ROW EXECUTE FUNCTION public._guard_ended_via_pcomment();

DROP TRIGGER IF EXISTS trg_guard_ended ON public.community_post_comment_likes;
CREATE TRIGGER trg_guard_ended BEFORE INSERT OR UPDATE OR DELETE ON public.community_post_comment_likes
  FOR EACH ROW EXECUTE FUNCTION public._guard_ended_via_ccomment();

DROP TRIGGER IF EXISTS trg_guard_ended_programs ON public.programs;
CREATE TRIGGER trg_guard_ended_programs BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public._guard_ended_programs();
