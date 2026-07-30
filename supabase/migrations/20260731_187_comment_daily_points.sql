-- ============================================================
-- Migration: 187 - 댓글 활동 점수 (커뮤니티 활성화 유도)
-- 작성일: 2026-07-31
-- 설명:
--   다른 참여자의 게시글/인증글에 댓글·답글을 달면 하루 최대 N개까지 점수 부여.
--   운영자 설정(기본 OFF). 커뮤니티 활성화가 시들할 때 켜는 반응형 기능.
--
--   자격: 댓글 작성자 ≠ 대상 글 주인, 공백 제외 3글자 이상, 활성 참여자,
--         발행(PUBLISHED)·미종료 프로그램, 공지 게시판(board_id='notice') 제외.
--   하루 = (created_at AT TIME ZONE 'Asia/Seoul')::date  ← 23:59/00:01 정확히 분리(마이그 169 교훈).
--   중복/경합 방지: score_ledgers.comment_award_key(program:user:KST날짜:순번) UNIQUE + ON CONFLICT.
--   랭킹은 reason 무관 SUM(point)라 자동 반영(기간 필터도 created_at 기준).
--
--   운영자 컬럼(programs): comment_points_enabled / comment_points / comment_points_daily_limit.
--   트리거: post_comments(인증글) + community_post_comments(게시판) 양쪽.
--
-- 하위호환: 컬럼 추가(기본값)·인덱스·새 함수/트리거. 기존 동작 무영향(기본 OFF).
-- 복구: 트리거 DROP + 컬럼 DROP + comment_award_key/인덱스 DROP.
-- ============================================================

-- 1) 운영자 설정 컬럼
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS comment_points_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS comment_points             INT     NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS comment_points_daily_limit INT     NOT NULL DEFAULT 1;

-- 2) 원장 중복 방지 키 (댓글 점수 전용, 부분 UNIQUE)
ALTER TABLE public.score_ledgers
  ADD COLUMN IF NOT EXISTS comment_award_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_score_ledgers_comment_award_key
  ON public.score_ledgers(comment_award_key) WHERE comment_award_key IS NOT NULL;

-- 3) 공용 적립 헬퍼 — 자격 판정 + 하루 캡 + 멱등 INSERT
CREATE OR REPLACE FUNCTION public._award_comment_points(
  p_program UUID, p_user UUID, p_owner UUID, p_created_at TIMESTAMPTZ, p_content TEXT, p_is_notice BOOLEAN
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prog public.programs;
  v_kst_date TEXT;
  v_len INT;
  v_seq INT;
BEGIN
  IF p_is_notice THEN RETURN; END IF;                            -- 공지 게시판 제외
  IF p_owner IS NULL OR p_owner = p_user THEN RETURN; END IF;    -- 본인 글/주인 없음 제외
  -- 공백 제외 3글자 이상
  v_len := char_length(regexp_replace(COALESCE(p_content, ''), '[[:space:]]', '', 'g'));
  IF v_len < 3 THEN RETURN; END IF;

  SELECT * INTO v_prog FROM public.programs WHERE id = p_program;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT v_prog.comment_points_enabled THEN RETURN; END IF;
  IF v_prog.status <> 'PUBLISHED' THEN RETURN; END IF;
  IF COALESCE(v_prog.comment_points, 0) <= 0 OR COALESCE(v_prog.comment_points_daily_limit, 0) <= 0 THEN RETURN; END IF;
  -- 종료 프로그램 제외 (KST 기준)
  IF v_prog.end_date IS NOT NULL
     AND (p_created_at AT TIME ZONE 'Asia/Seoul')::date > v_prog.end_date THEN
    RETURN;
  END IF;
  -- 활성 참여자만 (운영자·비참여자 제외)
  IF NOT public._is_active_participant(p_program, p_user) THEN RETURN; END IF;

  v_kst_date := to_char(p_created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD');

  -- 오늘(KST) 이미 적립된 댓글 점수 개수 (키의 날짜 파트로 카운트 — UUID엔 ':' 없음)
  SELECT COUNT(*) INTO v_seq
  FROM public.score_ledgers
  WHERE program_id = p_program AND user_id = p_user AND reason = 'comment_daily'
    AND split_part(comment_award_key, ':', 3) = v_kst_date;

  v_seq := v_seq + 1;
  IF v_seq > v_prog.comment_points_daily_limit THEN RETURN; END IF;

  INSERT INTO public.score_ledgers (program_id, user_id, point, reason, comment_award_key)
  VALUES (
    p_program, p_user, v_prog.comment_points, 'comment_daily',
    p_program::text || ':' || p_user::text || ':' || v_kst_date || ':' || v_seq
  )
  ON CONFLICT (comment_award_key) DO NOTHING;
END;
$$;

-- 4) 인증글 댓글 트리거 함수
CREATE OR REPLACE FUNCTION public.grant_comment_points_verification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner UUID; v_program UUID;
BEGIN
  SELECT v.user_id, m.program_id INTO v_owner, v_program
  FROM public.verifications v
  JOIN public.missions m ON m.id = v.mission_id
  WHERE v.id = NEW.verification_id;

  PERFORM public._award_comment_points(v_program, NEW.user_id, v_owner, NEW.created_at, NEW.content, FALSE);
  RETURN NEW;
END;
$$;

-- 5) 게시판 댓글 트리거 함수 (공지 게시판 제외)
CREATE OR REPLACE FUNCTION public.grant_comment_points_community()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner UUID; v_program UUID; v_board TEXT;
BEGIN
  SELECT cp.author_id, cp.program_id, cp.board_id INTO v_owner, v_program, v_board
  FROM public.community_posts cp
  WHERE cp.id = NEW.post_id;

  PERFORM public._award_comment_points(v_program, NEW.user_id, v_owner, NEW.created_at, NEW.content, (v_board = 'notice'));
  RETURN NEW;
END;
$$;

-- 6) 트리거 바인딩
DROP TRIGGER IF EXISTS trg_comment_points_verification ON public.post_comments;
CREATE TRIGGER trg_comment_points_verification
  AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.grant_comment_points_verification();

DROP TRIGGER IF EXISTS trg_comment_points_community ON public.community_post_comments;
CREATE TRIGGER trg_comment_points_community
  AFTER INSERT ON public.community_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.grant_comment_points_community();
