// send-push — 특정 user 의 Web Push 구독들에 알림 전송.
//   호출: DB 트리거(notify_push)/RPC(send_test_push) 가 net.http_post 로 호출.
//   인증: x-push-secret 헤더 == PUSH_HOOK_SECRET (DB GUC 와 동일).
//   시크릿(Edge Function secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
//     PUSH_HOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@dodam.app'
const HOOK_SECRET = Deno.env.get('PUSH_HOOK_SECRET') ?? ''
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  if (!HOOK_SECRET || req.headers.get('x-push-secret') !== HOOK_SECRET) {
    return new Response('unauthorized', { status: 401 })
  }
  let payload: Record<string, unknown>
  try { payload = await req.json() } catch { return new Response('bad json', { status: 400 }) }
  const userId = payload.user_id as string | undefined
  const title = payload.title as string | undefined
  if (!userId || !title) return new Response('missing user_id/title', { status: 400 })

  const admin = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } })
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
  if (error) return new Response(error.message, { status: 500 })

  const body = JSON.stringify({
    title,
    body: (payload.body as string) ?? '',
    link: (payload.link as string) ?? '/',
    tag: (payload.tag as string) ?? undefined,
  })

  const dead: string[] = []
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
      )
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode
      if (code === 404 || code === 410) dead.push(s.id)  // 만료된 구독 정리
    }
  }))
  if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead)

  return new Response(
    JSON.stringify({ targets: subs?.length ?? 0, removed: dead.length }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
