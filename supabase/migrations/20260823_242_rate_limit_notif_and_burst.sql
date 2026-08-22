-- ============================================================
-- Migration: 242 - 레이트 리밋 (알림 중복 억제 + 쓰기 버스트 가드)
-- 작성일: 2026-08-23
-- 설명:
--   영상 ②(상태변경 루프 차단)에 대응. 도담의 실질적 남용:
--     (1) 좋아요 취소→재좋아요 / 반복 액션 루프 → 피해자에게 알림 폭탄
--     (2) 자동 루프로 글·댓글 도배(피드 홍수)
--
--   (1) notifications BEFORE INSERT 중복 억제:
--       같은 (수신자, type, actor, ref_table, ref_id) 알림이 최근 6시간 내 있으면 새 알림 스킵.
--       actor_id·ref_id 둘 다 있는 "행위자 알림"만 대상 → 시스템 알림(종료 등)은 영향 없음.
--       모든 알림 소스(좋아요·댓글·승인 등)를 한 곳에서 커버.
--   (2) 콘텐츠 쓰기 버스트 가드: 계정당 분당 상한(사람은 못 넘을 만큼 관대, 루프만 차단).
--       community_posts 10/분, community_post_comments·post_comments 20/분.
--       서비스롤(auth.uid() NULL)·시스템은 예외.
--
-- 하위호환: 정상 사용자·기존 데이터 무영향(한도가 매우 관대, 중복 알림만 억제).
-- 복구: 아래 트리거·함수 DROP.
-- ============================================================

-- ── (1) 알림 중복 억제 ────────────────────────────────────
CREATE OR REPLACE FUNCTION public._notif_dedup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 행위자+대상이 명확한 알림만 중복 억제(시스템 알림 제외)
  IF NEW.actor_id IS NOT NULL AND NEW.ref_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = NEW.user_id
        AND n.type = NEW.type
        AND n.actor_id = NEW.actor_id
        AND n.ref_table IS NOT DISTINCT FROM NEW.ref_table
        AND n.ref_id = NEW.ref_id
        AND n.created_at > now() - interval '6 hours'
    ) THEN
      RETURN NULL;   -- 최근 동일 알림 있음 → 새 알림 생성 스킵
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_dedup ON public.notifications;
CREATE TRIGGER trg_notif_dedup BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public._notif_dedup();

-- ── (2) 쓰기 버스트 가드 (분당 상한) ──────────────────────
--   TG_ARGV[0]=작성자 컬럼명, TG_ARGV[1]=분당 최대. 초과 시 예외.
CREATE OR REPLACE FUNCTION public._guard_write_burst()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor UUID;
  v_max   INT := TG_ARGV[1]::int;
  v_cnt   INT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;   -- 서비스롤/시스템 예외
  v_actor := (row_to_json(NEW) ->> TG_ARGV[0])::uuid;
  IF v_actor IS NULL THEN RETURN NEW; END IF;
  EXECUTE format(
    'SELECT count(*) FROM public.%I WHERE %I = $1 AND created_at > now() - interval ''1 minute''',
    TG_TABLE_NAME, TG_ARGV[0]
  ) INTO v_cnt USING v_actor;
  IF v_cnt >= v_max THEN
    RAISE EXCEPTION '너무 빠르게 작성하고 있어요. 잠시 후 다시 시도해 주세요.'
      USING ERRCODE = 'P0001', HINT = 'rate_limited';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_write_burst ON public.community_posts;
CREATE TRIGGER trg_write_burst BEFORE INSERT ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public._guard_write_burst('author_id', '10');

DROP TRIGGER IF EXISTS trg_write_burst ON public.community_post_comments;
CREATE TRIGGER trg_write_burst BEFORE INSERT ON public.community_post_comments
  FOR EACH ROW EXECUTE FUNCTION public._guard_write_burst('user_id', '20');

DROP TRIGGER IF EXISTS trg_write_burst ON public.post_comments;
CREATE TRIGGER trg_write_burst BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public._guard_write_burst('user_id', '20');
