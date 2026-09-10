-- ============================================================
-- Migration: 259 - 네이티브(FCM) 푸시 토큰 저장 테이블
-- 작성일: 2026-09-11
-- 설명:
--   네이티브 앱(Capacitor Android)은 Web Push(PushManager)를 못 써서
--   FCM(Firebase Cloud Messaging) 토큰으로 푸시를 받는다. 그 등록 토큰을
--   사용자별로 저장한다. 발송 Edge Function(send-push)이 이 테이블을 읽어
--   FCM HTTP v1 로 전송(Web Push 와 «병행»).
--   token UNIQUE — 같은 기기 재등록 시 upsert.
--
--   ⚠️ 기존 Web Push(push_subscriptions)는 그대로. 이 테이블은 네이티브 전용 추가.
--
-- 하위호환: 신규 테이블만. 기존 동작 무변경(발송 함수가 이 테이블을 아직 안 읽어도 무해).
--
-- 복구: DROP TABLE IF EXISTS public.native_push_tokens;
-- ============================================================

CREATE TABLE IF NOT EXISTS public.native_push_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,               -- FCM registration token
  platform   text NOT NULL DEFAULT 'android',    -- 'android' | 'ios'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_native_push_user ON public.native_push_tokens(user_id);

ALTER TABLE public.native_push_tokens ENABLE ROW LEVEL SECURITY;

-- 본인 토큰만 조회·삽입·수정·삭제 (발송은 service role 이 RLS 우회)
DROP POLICY IF EXISTS "own native push tokens" ON public.native_push_tokens;
CREATE POLICY "own native push tokens" ON public.native_push_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
