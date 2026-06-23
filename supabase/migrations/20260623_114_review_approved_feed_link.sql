-- ============================================================
-- Migration: 114 - 인증 승인 알림 link_path 를 피드 딥링크로 (개요 X)
-- 작성일: 2026-06-23
-- 설명:
--   REVIEW_APPROVED('✅ 인증이 승인됐어요') 알림을 클릭하면 프로그램 개요(/programs/:id)
--   로만 이동해, 정작 승인된 인증을 못 보는 버그가 있었음.
--   개선:
--     · 피드 활성(feed_enabled) → /programs/:id/feed?v=<verification_id>
--         → 그 인증으로 직행(피드 포커스·하이라이트). 111(자동승인)/와 동일 패턴.
--     · 피드 비활성 → /programs/:id (개요, 기존 폴백 유지)
--   notify_on_verification_review (113) 의 APPROVED 분기 link_path 만 교체.
--   REJECTED 분기는 사유성 알림(클릭 시 사유 펼침)이라 link_path 이동 안 함 → 유지.
--
--   + 기존에 잘못 박힌 REVIEW_APPROVED 알림(link_path=/programs/:id)도
--     ref_id(=verification) 로 백필. 피드 활성 프로그램 건만.
--
-- 복구: 113 의 함수 블록 재실행. (백필은 되돌릴 필요 없음 — 더 정확한 경로로 갱신일 뿐)
-- ============================================================

-- 1) 트리거 함수 — APPROVED link_path 를 피드 딥링크로
CREATE OR REPLACE FUNCTION public.notify_on_verification_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission_title TEXT;
  v_program_id UUID;
  v_program_name TEXT;
  v_point INT;
  v_type TEXT;
  v_feed_enabled BOOLEAN;
  v_link TEXT;
BEGIN
  IF OLD.status != 'PENDING_REVIEW' THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('APPROVED', 'REJECTED') THEN RETURN NEW; END IF;

  v_type := CASE NEW.status WHEN 'APPROVED' THEN 'REVIEW_APPROVED' ELSE 'REVIEW_REJECTED' END;
  IF NOT public.is_notification_enabled(NEW.user_id, v_type) THEN RETURN NEW; END IF;

  SELECT m.title, m.program_id, m.point, p.name, p.feed_enabled
  INTO v_mission_title, v_program_id, v_point, v_program_name, v_feed_enabled
  FROM public.missions m
  JOIN public.programs p ON p.id = m.program_id
  WHERE m.id = NEW.mission_id;

  IF NEW.status = 'APPROVED' THEN
    v_link := CASE
      WHEN v_feed_enabled THEN '/programs/' || v_program_id::text || '/feed?v=' || NEW.id::text
      ELSE '/programs/' || v_program_id::text
    END;
    INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
    VALUES (
      NEW.user_id,
      'REVIEW_APPROVED',
      '✅ 인증이 승인됐어요',
      v_mission_title || ' — +' || v_point || 'P 획득 (' || v_program_name || ')',
      v_link,
      'verifications',
      NEW.id
    );
  ELSIF NEW.status = 'REJECTED' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_path, ref_table, ref_id)
    VALUES (
      NEW.user_id,
      'REVIEW_REJECTED',
      '❌ 인증이 반려됐어요',
      v_program_name || E'\n' || v_mission_title
        || CASE WHEN btrim(COALESCE(NEW.rejection_reason, '')) <> '' THEN E'\n사유: ' || NEW.rejection_reason ELSE '' END,
      '/programs/' || v_program_id::text,
      'verifications',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 2) 백필 — 기존 REVIEW_APPROVED 알림 link_path 를 피드 딥링크로 갱신 (피드 활성 프로그램만)
UPDATE public.notifications n
SET link_path = '/programs/' || m.program_id::text || '/feed?v=' || n.ref_id::text
FROM public.verifications v
JOIN public.missions m ON m.id = v.mission_id
JOIN public.programs p ON p.id = m.program_id
WHERE n.type = 'REVIEW_APPROVED'
  AND n.ref_table = 'verifications'
  AND n.ref_id = v.id
  AND p.feed_enabled = true
  AND (n.link_path IS NULL OR n.link_path NOT LIKE '%/feed?v=%');
