-- ============================================================
-- Migration: 175 - 신고자 오신고(기각) 이력 집계 RPC
-- 작성일: 2026-07-27
-- 설명:
--   무단(악의적) 신고 대응. 운영자가 신고 관리 화면에서 각 신고자의
--   "지난 오신고 이력"을 보고 상습 허위신고자를 식별할 수 있게 한다.
--
--   get_reporter_report_stats(p_program_id) — 해당 프로그램 안에서
--   신고자(reporter_id)별로:
--     · total     : 그 신고자가 낸 신고 총 건수
--     · dismissed : '기각'으로 추정되는 건수
--                   = 운영자가 처리(resolved=true)했는데 대상 콘텐츠가 현재
--                     노출 중인 것(게시글 status='visible' / 인증 feed_visible=true).
--                     즉 운영자가 신고를 인용하지 않고 노출을 유지·복구한 경우.
--   (미처리 신고는 dismissed 로 세지 않음 — 아직 판정 전.)
--
--   RLS 우회 집계(SECURITY DEFINER)지만, 호출자가 그 프로그램의 소유자(운영자)
--   또는 관리자일 때만 허용. 신고자 신원(reporter_id)은 원래 운영자에게만
--   공개되는 정보이므로 범위 일관.  프로그램 단위로만 집계(타 프로그램 행동은 미노출).
--
-- 하위호환: 신규 함수만. 기존 동작 무변경.
--
-- 복구: DROP FUNCTION IF EXISTS public.get_reporter_report_stats(uuid);
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_reporter_report_stats(p_program_id uuid)
RETURNS TABLE(reporter_id uuid, total int, dismissed int)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
        SELECT 1 FROM public.programs
         WHERE id = p_program_id AND owner_id = auth.uid()
      ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN QUERY
  SELECT r.reporter_id,
         count(*)::int AS total,
         count(*) FILTER (
           WHERE r.resolved = true AND (
                (r.target_type = 'post' AND EXISTS (
                    SELECT 1 FROM public.community_posts cp
                     WHERE cp.id = r.target_id AND cp.status = 'visible'))
             OR (r.target_type = 'verification' AND EXISTS (
                    SELECT 1 FROM public.verifications v
                     WHERE v.id = r.target_id AND v.feed_visible = true))
           )
         )::int AS dismissed
  FROM public.reports r
  WHERE r.program_id = p_program_id
  GROUP BY r.reporter_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reporter_report_stats(uuid) TO authenticated;
