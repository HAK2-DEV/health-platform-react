-- ============================================================
-- Migration: 040 - notifications 테이블 + RLS
-- 작성일: 2026-05-25
-- 설명: 참여자 알림 — 심사 결과 / 좋아요 / 댓글.
--   본인의 MVP 1차는 polling. 만명 규모는 Realtime 도입 시점에 같은 구조 위에서 진화.
--
-- 컬럼:
--   user_id        알림 받는 사용자 (본인)
--   type           'REVIEW_APPROVED' / 'REVIEW_REJECTED' / 'POST_LIKE' / 'POST_COMMENT'
--   title          한 줄 헤드라인 (예: "✅ 인증이 승인됐어요")
--   body           디테일 (예: "운동 사진 — +10P 획득")
--   link_path      클릭 시 이동할 경로 (예: '/programs/:id/feed')
--   is_read        읽음 여부 (디폴트 false)
--   actor_id       알림을 발생시킨 사용자 (좋아요/댓글 작성자) — 본인 알림에는 NULL
--   ref_table      관련 테이블명 ('verifications' / 'post_likes' / 'post_comments')
--   ref_id         관련 행 id (verifications.id 등) — ON DELETE CASCADE 는 아니라서
--                  원본 삭제 시 알림은 남고 link_path 만 깨질 수 있음 (트레이드오프)
--
-- RLS:
--   SELECT: user_id = auth.uid()
--   UPDATE: user_id = auth.uid() (읽음 표시)
--   DELETE: user_id = auth.uid()
--   INSERT: 일반 사용자 INSERT 정책 없음 — 041 트리거가 SECURITY DEFINER 로 우회
--
-- 복구:
--   supabase/rollbacks/040_revert_notifications.sql 수동 실행.
-- ============================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'REVIEW_APPROVED', 'REVIEW_REJECTED', 'POST_LIKE', 'POST_COMMENT'
  )),
  title TEXT NOT NULL,
  body TEXT,
  link_path TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ref_table TEXT,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 본인 알림 시간순 조회 + 안 읽은 카운트 조회 인덱스
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 알림만
CREATE POLICY "view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- UPDATE: 본인 알림 (읽음 표시)
CREATE POLICY "update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- DELETE: 본인 알림 (정리)
CREATE POLICY "delete own notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ADMIN
CREATE POLICY "admins can do anything on notifications"
ON public.notifications
FOR ALL
TO authenticated
USING (public.is_admin());
