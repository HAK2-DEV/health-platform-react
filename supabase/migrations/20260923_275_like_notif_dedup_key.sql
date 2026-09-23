-- ============================================================
-- Migration: 275 - 좋아요 알림 연타 중복 (BUG_LOG 17)
-- 작성일: 2026-09-23
-- 설명:
--   제보: 「한 게시판에서 좋아요를 연타하면 알림이 계속 온다」(인증 게시판, 네이티브 앱).
--
--   원인: 좋아요 알림의 ref_id 가 «대상 글»이 아니라 «좋아요 행의 id» 였다.
--     - notify_on_post_like            → ref_table='post_likes',           ref_id=NEW.id
--     - notify_on_community_post_like  → ref_table='community_post_likes', ref_id=NEW.id
--   좋아요를 취소하면 그 행이 삭제되고 다시 누르면 새 id 로 새 행이 생긴다.
--   마이그 242 의 중복 억제(_notif_dedup)는 (user_id, type, actor_id, ref_table, ref_id) 로
--   판정하는데, ref_id 가 매번 달라지니 «영원히 안 걸렸다».
--   242 는 주석에 「좋아요 취소→재좋아요 알림 폭탄」을 막겠다고 적어 두고 실제로는 못 막고 있었다.
--
--   확인(2026-09-23 프로덕션): POST_LIKE 124건 중 같은 사람이 같은 글에 반복한 것 17건
--   (최다 14번, 10~19초 간격). 같은 ref_id 가 2건 이상인 경우는 0개 — 매번 새 id 였다는 뜻.
--   ⚠️ 알림뿐 아니라 푸시(178 트리거 → send-push)도 그만큼 나갔다.
--
--   고침: ref_id 를 «대상 글» 로 바꾼다.
--     - post_likes            → NEW.verification_id   (UNIQUE(verification_id, user_id) 가 있어 1인 1글)
--     - community_post_likes  → NEW.post_id           (UNIQUE(post_id, user_id))
--   이러면 242 가 의도대로 걸려 «한 사람이 한 글에 6시간 1건» 이 된다.
--   서로 다른 사람의 좋아요, 다른 글의 좋아요는 그대로 각각 알림이 간다.
--
--   함수 본문은 최신 정의(마이그 191)를 그대로 옮기고 ref_id 만 바꿨다.
--   ⚠️ 191 이후 이 두 함수를 건드린 마이그가 더 있으면 그쪽을 기준으로 다시 맞출 것.
--
--   (2) 이미 쌓인 중복 알림 정리 — 본인 결정(2026-09-23).
--       같은 날(KST)·같은 수신자·같은 행위자·같은 link_path·같은 body 묶음에서 «최신 1건»만 남긴다.
--       ⚠️ 한계: 인증 게시판 좋아요의 link_path 는 /programs/{id}/feed (피드 전체)라
--       «글 단위»가 아니다. 그래서 같은 날 같은 사람이 내 여러 인증글에 누른 좋아요도 한 묶음이 된다.
--       받는 사람 입장에서 같은 날 같은 사람의 좋아요 알림이 하나로 줄 뿐이라 실질적인 해는 없다고 봤다.
--       드라이런(2026-09-23): actor_id 있는 POST_LIKE 107건 → 묶음 67개, 삭제 대상 40건.
--       (POST_LIKE 전체는 124건이나 17건은 actor_id 가 없는 옛 알림이라 대상이 아니다.)
--
-- 하위호환: 트리거 시그니처·타입·link_path 모두 그대로. ref_id 값만 바뀐다.
--   notifications.ref_id 를 읽는 클라이언트 코드 없음(확인함), ref_id 로 알림을 지우는 트리거도 없음.
-- 복구: supabase/rollbacks/275_revert_like_notif_dedup_key.sql
--   ⚠️ 삭제한 알림은 되돌릴 수 없다(트리거만 원복 가능).
-- ============================================================

-- ── (1) 인증 게시판 좋아요 ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_post_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner_id UUID;
  v_program_id UUID;
  v_actor_nickname TEXT;
BEGIN
  SELECT v.user_id, m.program_id
  INTO v_owner_id, v_program_id
  FROM public.verifications v
  JOIN public.missions m ON m.id = v.mission_id
  WHERE v.id = NEW.verification_id;

  IF v_owner_id = NEW.user_id THEN RETURN NEW; END IF;
  IF NOT public.is_notification_enabled(v_owner_id, 'POST_LIKE') THEN RETURN NEW; END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_owner_id,
    'POST_LIKE',
    '❤️ 새 좋아요',
    COALESCE(v_actor_nickname, '(?)') || '님이 내 인증글에 좋아요를 눌렀어요',
    '/programs/' || v_program_id::text || '/feed',
    NEW.user_id,
    'post_likes',
    NEW.verification_id   -- ← 좋아요 행 id 가 아니라 «대상 인증글»
  );

  RETURN NEW;
END;
$$;

-- ── (2) 커뮤니티 게시글 좋아요 ─────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_community_post_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_author_id UUID;
  v_program_id UUID;
  v_board_id TEXT;
  v_actor_nickname TEXT;
BEGIN
  SELECT cp.author_id, cp.program_id, cp.board_id
  INTO v_author_id, v_program_id, v_board_id
  FROM public.community_posts cp
  WHERE cp.id = NEW.post_id;

  IF v_author_id IS NULL OR v_author_id = NEW.user_id THEN RETURN NEW; END IF;
  IF NOT public.is_notification_enabled(v_author_id, 'POST_LIKE') THEN RETURN NEW; END IF;

  SELECT nickname INTO v_actor_nickname FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, actor_id, ref_table, ref_id)
  VALUES (
    v_author_id,
    'POST_LIKE',
    '❤️ 새 좋아요',
    COALESCE(v_actor_nickname, '(?)') || '님이 내 게시글에 좋아요를 눌렀어요',
    '/programs/' || v_program_id::text || '?tab=community&board=' || v_board_id || '&post=' || NEW.post_id::text,
    NEW.user_id,
    'community_post_likes',
    NEW.post_id   -- ← 좋아요 행 id 가 아니라 «대상 게시글»
  );

  RETURN NEW;
END;
$$;

-- ── (3) 이미 쌓인 중복 알림 정리 ───────────────────────────
--   각 묶음에서 최신 1건만 남긴다. 읽음 상태와 무관하게 «가장 최근 것»을 보존한다.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, actor_id, link_path, body,
                        ((created_at AT TIME ZONE 'Asia/Seoul')::date)
           ORDER BY created_at DESC
         ) AS rn
  FROM public.notifications
  WHERE type = 'POST_LIKE'
    AND actor_id IS NOT NULL
)
DELETE FROM public.notifications n
USING ranked r
WHERE n.id = r.id
  AND r.rn > 1;
