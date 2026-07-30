-- ============================================================
-- Migration: 189 - 댓글점수 적립에 "유발 댓글" 참조 기록
-- 작성일: 2026-07-31
-- 설명:
--   댓글 활동 점수(187/188)는 (user, program, KST날짜) 버킷으로 적립돼, "어느 댓글이 점수를
--   받았는지"가 원장에 없었다. 참여자에게 "점수 인정된 내 댓글" 옆에 점수를 표시하려면
--   적립을 유발한 그 댓글을 알아야 함 → score_ledgers 에 comment_ref_table/comment_ref_id 추가하고
--   _award_comment_points() 가 INSERT 시 그 댓글(NEW.id)을 함께 저장.
--     · 하루 한도 안에서 "실제로 점수가 잡힌 그 댓글"만 참조로 남음(그날 첫 N개).
--
-- 하위호환: 컬럼 추가(NULL 허용). 기존 적립 행은 참조 NULL(과거분엔 배지 안 뜸). 함수 시그니처만 확장.
-- 복구: 트리거를 187 정의로, 컬럼 DROP.
-- ============================================================

-- 1) 참조 컬럼
ALTER TABLE public.score_ledgers
  ADD COLUMN IF NOT EXISTS comment_ref_table TEXT,
  ADD COLUMN IF NOT EXISTS comment_ref_id UUID;

-- 2) 헬퍼 — 참조 인자 2개 추가(구 6-인자 버전 제거 후 8-인자로)
DROP FUNCTION IF EXISTS public._award_comment_points(UUID, UUID, UUID, TIMESTAMPTZ, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION public._award_comment_points(
  p_program UUID, p_user UUID, p_owner UUID, p_created_at TIMESTAMPTZ, p_content TEXT, p_is_notice BOOLEAN,
  p_ref_table TEXT, p_ref_id UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prog public.programs;
  v_kst_date TEXT;
  v_len INT;
  v_seq INT;
BEGIN
  IF p_is_notice THEN RETURN; END IF;
  IF p_owner IS NULL OR p_owner = p_user THEN RETURN; END IF;
  v_len := char_length(regexp_replace(COALESCE(p_content, ''), '[[:space:]]', '', 'g'));
  IF v_len < 3 THEN RETURN; END IF;

  SELECT * INTO v_prog FROM public.programs WHERE id = p_program;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT v_prog.comment_points_enabled THEN RETURN; END IF;
  IF v_prog.status <> 'PUBLISHED' THEN RETURN; END IF;
  IF COALESCE(v_prog.comment_points, 0) <= 0 OR COALESCE(v_prog.comment_points_daily_limit, 0) <= 0 THEN RETURN; END IF;
  IF v_prog.end_date IS NOT NULL
     AND (p_created_at AT TIME ZONE 'Asia/Seoul')::date > v_prog.end_date THEN
    RETURN;
  END IF;
  IF NOT public._is_active_participant(p_program, p_user) THEN RETURN; END IF;

  v_kst_date := to_char(p_created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD');

  SELECT COUNT(*) INTO v_seq
  FROM public.score_ledgers
  WHERE program_id = p_program AND user_id = p_user AND reason = 'comment_daily'
    AND split_part(comment_award_key, ':', 3) = v_kst_date;

  v_seq := v_seq + 1;
  IF v_seq > v_prog.comment_points_daily_limit THEN RETURN; END IF;

  INSERT INTO public.score_ledgers (program_id, user_id, point, reason, comment_award_key, comment_ref_table, comment_ref_id)
  VALUES (
    p_program, p_user, v_prog.comment_points, 'comment_daily',
    p_program::text || ':' || p_user::text || ':' || v_kst_date || ':' || v_seq,
    p_ref_table, p_ref_id
  )
  ON CONFLICT (comment_award_key) DO NOTHING;
END;
$$;

-- 3) 트리거 함수 — 유발 댓글(NEW.id) + 테이블명 전달
CREATE OR REPLACE FUNCTION public.grant_comment_points_verification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner UUID; v_program UUID;
BEGIN
  SELECT v.user_id, m.program_id INTO v_owner, v_program
  FROM public.verifications v
  JOIN public.missions m ON m.id = v.mission_id
  WHERE v.id = NEW.verification_id;

  PERFORM public._award_comment_points(v_program, NEW.user_id, v_owner, NEW.created_at, NEW.content, FALSE, 'post_comments', NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_comment_points_community()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner UUID; v_program UUID; v_board TEXT;
BEGIN
  SELECT cp.author_id, cp.program_id, cp.board_id INTO v_owner, v_program, v_board
  FROM public.community_posts cp
  WHERE cp.id = NEW.post_id;

  PERFORM public._award_comment_points(v_program, NEW.user_id, v_owner, NEW.created_at, NEW.content, (v_board = 'notice'), 'community_post_comments', NEW.id);
  RETURN NEW;
END;
$$;
