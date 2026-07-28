-- ============================================================
-- Migration: 177 - Web Push 구독 저장 테이블
-- 작성일: 2026-07-29
-- 설명:
--   PWA Web Push(폰 시스템 알림)용. 브라우저 PushManager 구독을 사용자별로 저장.
--   발송 Edge Function(send-push)이 이 테이블을 읽어 web-push 전송.
--   endpoint UNIQUE — 같은 기기/브라우저 재구독 시 upsert.
--
-- 하위호환: 신규 테이블만. 기존 동작 무변경.
--
-- 복구: DROP TABLE IF EXISTS public.push_subscriptions;
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,     -- 구독 keys.p256dh
  auth       text NOT NULL,     -- 구독 keys.auth
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 본인 구독만 조회·삽입·삭제 (발송은 service role 이 RLS 우회)
DROP POLICY IF EXISTS "own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "own push subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
