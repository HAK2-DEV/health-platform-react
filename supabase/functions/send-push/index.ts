// send-push — 특정 user 에게 알림 전송. Web Push(브라우저/PWA) + FCM(네이티브 앱) «병행».
//   호출: DB 트리거(notify_push)/RPC(send_test_push) 가 net.http_post 로 호출.
//   인증: x-push-secret 헤더 == PUSH_HOOK_SECRET (DB GUC 와 동일).
//   시크릿(Edge Function secrets):
//     Web Push: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//     FCM(네이티브): FCM_SERVICE_ACCOUNT (Firebase 서비스계정 JSON 전체를 문자열로)
//     공통: PUSH_HOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@dodam.app'
const HOOK_SECRET = Deno.env.get('PUSH_HOOK_SECRET') ?? ''
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const FCM_SA_RAW = Deno.env.get('FCM_SERVICE_ACCOUNT') ?? ''

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

// ─── FCM (HTTP v1) — 서비스계정 JWT → 액세스 토큰 → messages:send ───
let FCM_SA: { client_email: string; private_key: string; project_id: string } | null = null
let FCM_SA_PARSE_ERR = ''
try { if (FCM_SA_RAW) FCM_SA = JSON.parse(FCM_SA_RAW) } catch (e) { FCM_SA = null; FCM_SA_PARSE_ERR = (e as Error).message }
// 진단(응답에 실림, 비밀값 없음): 시크릿 존재·파싱·필수 필드·키 형식만.
const FCM_SA_DIAG = {
  rawLen: FCM_SA_RAW.length,
  parsed: !!FCM_SA,
  parseErr: FCM_SA_PARSE_ERR || undefined,
  hasEmail: !!FCM_SA?.client_email,
  hasProject: !!FCM_SA?.project_id,
  keyPrefix: (FCM_SA?.private_key ?? '').slice(0, 27),          // "-----BEGIN PRIVATE KEY-----" 이어야
  keyHasNewline: (FCM_SA?.private_key ?? '').includes('\n'),   // 진짜 줄바꿈이어야 PEM 파싱됨
}

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlFromString(s: string): string {
  return b64urlFromBytes(new TextEncoder().encode(s))
}
function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '')
  const bin = atob(body)
  const der = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i)
  return der
}

let fcmTokenCache: { token: string; exp: number } | null = null
async function getFcmAccessToken(): Promise<string> {
  if (!FCM_SA) throw new Error('FCM_SERVICE_ACCOUNT 미설정')
  if (fcmTokenCache && Date.now() < fcmTokenCache.exp - 60_000) return fcmTokenCache.token
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: FCM_SA.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${b64urlFromString(JSON.stringify(header))}.${b64urlFromString(JSON.stringify(claims))}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(FCM_SA.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${b64urlFromBytes(new Uint8Array(sig))}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const j = await res.json()
  if (!j.access_token) throw new Error('FCM 토큰 교환 실패: ' + JSON.stringify(j))
  fcmTokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 }
  return j.access_token
}

// 반환: 'ok' | 'dead'(토큰 만료·미등록) | 'err'
// 반환: result 'ok' | 'dead'(토큰 미등록 — 삭제 대상) | 'err', detail=진단 문자열(모듈 전역 대신 «호출별» 값)
async function sendFcm(accessToken: string, token: string, title: string, body: string, link: string): Promise<{ result: 'ok' | 'dead' | 'err'; detail: string }> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_SA!.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: link ? { link } : {},
        android: { priority: 'HIGH', notification: { default_sound: true } },
      },
    }),
  })
  if (res.ok) return { result: 'ok', detail: '' }
  // ⚠️ HTTP 404 «만»으로 죽은 토큰이라 판정하지 않는다 — project_id·서비스계정 오설정도 404 를 주는데,
  //   그렇게 되면 한 번의 발송으로 «전체 사용자의 토큰»이 지워진다(2026-09-14 리뷰). 본문 코드로만 확정.
  let txt = ''
  try { txt = await res.text() } catch { /* 본문 없음 */ }
  const detail = `${res.status} ${txt.slice(0, 300)}`
  let code = ''
  try {
    const err = JSON.parse(txt)
    code = err?.error?.details?.[0]?.errorCode || err?.error?.status || ''
  } catch { /* JSON 아님 */ }
  if (code === 'UNREGISTERED' || code === 'NOT_FOUND') return { result: 'dead', detail }
  return { result: 'err', detail }
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

  const bodyText = (payload.body as string) ?? ''
  const link = (payload.link as string) ?? '/'
  const tag = (payload.tag as string) ?? undefined

  const admin = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } })

  // ── 1) Web Push (브라우저/PWA) ──
  let webTargets = 0
  let webRemoved = 0
  const webResults: string[] = []
  {
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)
    const body = JSON.stringify({ title, body: bodyText, link, tag })
    const dead: string[] = []
    await Promise.all((subs ?? []).map(async (s) => {
      try {
        const r = await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body)
        webResults.push(`ok:${r?.statusCode ?? 201}`)
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode
        // 404/410 = 구독 소멸 → 정리. 그 외(401/403 VAPID·5xx 등)는 결과에만 남김(진단용, 비밀값 없음).
        webResults.push(`err:${code ?? (e as Error)?.message?.slice(0, 80) ?? '?'}`)
        if (code === 404 || code === 410) dead.push(s.id)
      }
    }))
    if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead)
    webTargets = subs?.length ?? 0
    webRemoved = dead.length
  }

  // ── 2) FCM (네이티브 앱) — 서비스계정 있을 때만 ──
  let fcmTargets = 0
  let fcmRemoved = 0
  let fcmError = ''
  let fcmResults: string[] = []
  if (FCM_SA) {
    try {
      const { data: toks, error: qErr } = await admin
        .from('native_push_tokens')
        .select('id, token')
        .eq('user_id', userId)
      if (qErr) throw new Error('토큰 조회 실패: ' + qErr.message)
      fcmTargets = toks?.length ?? 0   // ⭐ 발송 «전» 기록 — 인증 실패여도 대상 수는 정직하게
      if (toks && toks.length) {
        const accessToken = await getFcmAccessToken()
        const dead: string[] = []
        await Promise.all(toks.map(async (t) => {
          const r = await sendFcm(accessToken, t.token, title, bodyText, link)
          fcmResults.push(r.result === 'ok' ? 'ok' : `${r.result}:${r.detail}`)
          if (r.result === 'dead') dead.push(t.id)
        }))
        if (dead.length) await admin.from('native_push_tokens').delete().in('id', dead)
        fcmRemoved = dead.length
      }
    } catch (e) {
      fcmError = (e as Error).message
      console.error('FCM 발송 오류:', fcmError)
    }
  } else {
    fcmError = 'FCM_SA 없음(시크릿 미설정 또는 JSON 파싱 실패)'
  }

  return new Response(
    JSON.stringify({
      web: { targets: webTargets, removed: webRemoved, results: webResults.length ? webResults : undefined },
      fcm: { targets: fcmTargets, removed: fcmRemoved, error: fcmError || undefined, results: fcmResults.length ? fcmResults : undefined, sa: FCM_SA_DIAG },
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
