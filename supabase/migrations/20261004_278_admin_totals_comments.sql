-- ============================================================
-- Migration: 278 - 관리자 콘솔 「서비스 현황」에 «댓글» 추가
-- 작성일: 2026-10-04
-- 설명:
--   /admin 「서비스 현황」 타일에 게시글은 있는데 댓글이 없어 커뮤니티 활동의
--   절반이 안 보였다. 댓글 수를 집계에 더한다.
--
--   «댓글» 의 정의 — 참여자가 쓴 댓글 두 종류의 합이다.
--     · post_comments            인증(피드) 글의 댓글
--     · community_post_comments  커뮤니티 글의 댓글
--   ⚠️ inquiry_comments(1:1 문의·버그 신고 답글)는 «제외»한다. 고객지원 기록이라
--      서비스 활동 지표와 성격이 다르고, 관리자 답변이 섞여 수치의 뜻이 흐려진다.
--
--   고치는 곳은 «두 군데» 다. 한 곳만 고치면 전일 대비 증감이 깨진다.
--     1) admin_totals_now()      — 현재값(= 매일 자정 스냅샷의 재료)
--     2) admin_totals_as_of()    — 스냅샷이 없는 날짜의 전일 재계산 폴백
--   admin_totals() 자체는 admin_totals_now() 에 prev 를 덧붙이기만 하므로 손대지 않는다.
--
--   ⚠️ 이미 저장된 스냅샷에는 comments 키가 없다 → 그 날과 비교하는 동안에는
--      댓글 타일에 증감이 «표시되지 않는다»(화면의 DeltaLine 이 prev 없으면 숨김).
--      적용 직후 오늘 자 스냅샷을 다시 찍으므로 내일부터는 정상 표시된다.
--
--   하위호환: 기존 키는 이름·의미 그대로이고 키만 «추가» 된다 → 이 마이그레이션을
--   먼저 올려도 배포 전 구버전 화면이 그대로 동작한다. [[feedback_deploy_safety]]
--
-- 복구: supabase/rollbacks/278_revert_admin_totals_comments.sql
-- ============================================================

-- ── 1) 현재 집계 ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_totals_now()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'users',         (SELECT count(*) FROM public.users),
    'programs',      (SELECT count(*) FROM public.programs),
    'published',     (SELECT count(*) FROM public.programs WHERE status = 'PUBLISHED'),
    'participants',  (SELECT count(*) FROM public.program_participants WHERE status = 'ACTIVE'),
    'verifications', (SELECT count(*) FROM public.verifications),
    'posts',         (SELECT count(*) FROM public.community_posts),
    'comments',      (SELECT (SELECT count(*) FROM public.post_comments)
                           + (SELECT count(*) FROM public.community_post_comments)),
    'push_subs',     (SELECT count(*) FROM public.push_subscriptions),
    'sessions',      (SELECT count(*) FROM public.sessions)
  );
$fn$;

-- ── 2) 전일 집계 재계산 폴백 ─────────────────────────────
--   기준 시각은 «해당 날짜 24:00 KST». 두 댓글 테이블 모두 created_at 을 가진다.
--   ⚠️ 남아 있는 행만 세므로 삭제로 «줄어든 것»은 반영되지 않는다(증가만) — 268 과 같은 한계.
CREATE OR REPLACE FUNCTION public.admin_totals_as_of(p_date DATE)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH cut AS (
    SELECT ((p_date + 1)::timestamp AT TIME ZONE 'Asia/Seoul') AS ts   -- 그 날 24:00 KST
  )
  SELECT jsonb_build_object(
    'users',         (SELECT count(*) FROM public.users u, cut WHERE u.created_at < cut.ts),
    'programs',      (SELECT count(*) FROM public.programs p, cut WHERE p.created_at < cut.ts),
    -- 상태 전이(ENDED 등) 시각이 없어 근사: 그때 이미 발행돼 있었고 지금도 PUBLISHED 인 것
    'published',     (SELECT count(*) FROM public.programs p, cut
                       WHERE p.status = 'PUBLISHED' AND p.published_at IS NOT NULL AND p.published_at < cut.ts),
    'participants',  (SELECT count(*) FROM public.program_participants pp, cut
                       WHERE pp.status = 'ACTIVE' AND pp.joined_at < cut.ts),
    'verifications', (SELECT count(*) FROM public.verifications v, cut WHERE v.submitted_at < cut.ts),
    'posts',         (SELECT count(*) FROM public.community_posts c, cut WHERE c.created_at < cut.ts),
    'comments',      (SELECT (SELECT count(*) FROM public.post_comments pc, cut WHERE pc.created_at < cut.ts)
                           + (SELECT count(*) FROM public.community_post_comments cc, cut WHERE cc.created_at < cut.ts)),
    'push_subs',     (SELECT count(*) FROM public.push_subscriptions s, cut WHERE s.created_at < cut.ts),
    'sessions',      (SELECT count(*) FROM public.sessions s, cut WHERE s.created_at < cut.ts)
  );
$fn$;

-- ── 3) 권한 — 내부 헬퍼는 익명·일반 사용자에게 닫는다 ────
--   ⚠️ REVOKE ... FROM PUBLIC 만으로는 anon 이 막히지 않는다(268 에서 겪음 → 269 로 차단).
--      CREATE OR REPLACE 는 기존 권한을 유지하지만, 명시해 두어야 다음 사람이 안 헷갈린다.
--      admin_totals() 는 SECURITY DEFINER 라 소유자 권한으로 이 헬퍼들을 부른다 → 동작에 영향 없음.
--      [[feedback_revoke_from_public_footgun]]
REVOKE ALL ON FUNCTION public.admin_totals_now()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_totals_as_of(DATE)  FROM PUBLIC, anon, authenticated;

-- ── 4) 오늘 자 스냅샷 다시 찍기 ──────────────────────────
--   comments 키가 들어간 행으로 덮어써, 내일부터 전일 대비가 정상 표시되게 한다.
SELECT public.snapshot_admin_totals();
