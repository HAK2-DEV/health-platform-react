-- ============================================================
-- Migration: 193 - 완주 리포트용 「받은 응원」 집계 RPC
-- 작성일: 2026-07-31
-- 설명:
--   특정 프로그램에서 내 콘텐츠(인증글·게시글)가 남에게 받은 좋아요+댓글 총합.
--   완주 리포트 지표 「받은 응원」에 사용. 본인 좋아요/댓글은 제외.
--   4개 소스: post_likes / post_comments(인증) + community_post_likes / community_post_comments(게시판).
--
-- 하위호환: 새 함수만. authenticated EXECUTE.
-- 복구: DROP FUNCTION.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_received_cheers(p_program UUID, p_user UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v INT := 0;
BEGIN
  IF p_program IS NULL OR p_user IS NULL THEN RETURN 0; END IF;

  -- 인증글 좋아요 (내 인증에 남이 누른 좋아요)
  v := v + (
    SELECT COUNT(*) FROM public.post_likes pl
    JOIN public.verifications ve ON ve.id = pl.verification_id
    JOIN public.missions m ON m.id = ve.mission_id
    WHERE m.program_id = p_program AND ve.user_id = p_user AND pl.user_id <> p_user
  );
  -- 인증글 댓글 (내 인증에 남이 단 댓글/답글)
  v := v + (
    SELECT COUNT(*) FROM public.post_comments pc
    JOIN public.verifications ve ON ve.id = pc.verification_id
    JOIN public.missions m ON m.id = ve.mission_id
    WHERE m.program_id = p_program AND ve.user_id = p_user AND pc.user_id <> p_user
  );
  -- 게시글 좋아요 (내 글에 남이 누른 좋아요)
  v := v + (
    SELECT COUNT(*) FROM public.community_post_likes cpl
    JOIN public.community_posts cp ON cp.id = cpl.post_id
    WHERE cp.program_id = p_program AND cp.author_id = p_user AND cpl.user_id <> p_user
  );
  -- 게시글 댓글 (내 글에 남이 단 댓글/답글)
  v := v + (
    SELECT COUNT(*) FROM public.community_post_comments cc
    JOIN public.community_posts cp ON cp.id = cc.post_id
    WHERE cp.program_id = p_program AND cp.author_id = p_user AND cc.user_id <> p_user
  );

  RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_received_cheers(UUID, UUID) TO authenticated;
