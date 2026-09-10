// 네이티브(Capacitor) 앱 푸시 — FCM 토큰 등록·저장.
//   웹/PWA 는 Web Push(lib/push.js)를 그대로 쓴다. 네이티브만 이 경로.
//   FCM 토큰을 native_push_tokens 테이블(마이그 259)에 저장 → send-push Edge Function 이 FCM 발송.
import { supabase } from '../supabaseClient'
import { isNativeApp } from './installPrompt'

// @capacitor/push-notifications 는 네이티브에서만 의미 → 동적 import 로 웹 번들 영향 최소화.
async function getPlugin() {
  const mod = await import('@capacitor/push-notifications')
  return mod.PushNotifications
}

export function nativePushSupported() {
  return isNativeApp()
}

// 현재 권한 상태: 'granted' | 'denied' | 'prompt' | 'unsupported'
export async function getNativePushPermission() {
  if (!isNativeApp()) return 'unsupported'
  try {
    const PN = await getPlugin()
    const p = await PN.checkPermissions()
    return p.receive // 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'
  } catch {
    return 'unsupported'
  }
}

// 권한 요청 → register → FCM 토큰 수신 → native_push_tokens 저장.
export async function subscribeNativePush() {
  if (!isNativeApp()) throw new Error('네이티브 앱에서만 사용할 수 있어요.')
  const PN = await getPlugin()

  let perm = await PN.checkPermissions()
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PN.requestPermissions()
  }
  if (perm.receive !== 'granted') {
    throw new Error('알림 권한이 꺼져 있어요. 설정 > 앱 > 도담 > 알림에서 허용해주세요.')
  }

  // 토큰 수신 — ⚠️ 리스너가 «완전히 붙은 뒤» register() 해야 함(addListener 는 async라
  //   동기로 register 하면 registration 이벤트를 놓쳐 타임아웃남). addListener 를 await 한다.
  let done = false
  let resolveTok, rejectTok
  const finish = (fn, arg) => { if (!done) { done = true; fn(arg) } }
  const tokPromise = new Promise((res, rej) => { resolveTok = res; rejectTok = rej })
  const regH = await PN.addListener('registration', (t) => finish(resolveTok, t?.value))
  const errH = await PN.addListener('registrationError', (e) => finish(rejectTok, new Error(e?.error || '푸시 등록에 실패했어요.')))
  const timer = setTimeout(() => finish(rejectTok, new Error('푸시 토큰 수신이 지연됐어요. 잠시 후 다시 시도해주세요.')), 15000)
  let token
  try {
    await PN.register()
    token = await tokPromise
  } finally {
    clearTimeout(timer)
    try { await regH.remove() } catch { /* 무시 */ }
    try { await errH.remove() } catch { /* 무시 */ }
  }
  if (!token) throw new Error('푸시 토큰을 받지 못했어요.')

  const { data: u } = await supabase.auth.getUser()
  const uid = u?.user?.id
  if (!uid) throw new Error('로그인이 필요해요.')

  const { error } = await supabase
    .from('native_push_tokens')
    .upsert({ user_id: uid, token, platform: 'android', updated_at: new Date().toISOString() }, { onConflict: 'token' })
  if (error) throw error
  return token
}

// 구독 해제 — 이 기기 토큰 삭제 (+ 로컬 리스너 제거).
export async function unsubscribeNativePush() {
  if (!isNativeApp()) return
  try {
    const PN = await getPlugin()
    // 저장된 토큰을 정확히 지우려면 최근 토큰이 필요하나, 간단히 이 사용자 토큰 전부 삭제.
    const { data: u } = await supabase.auth.getUser()
    const uid = u?.user?.id
    if (uid) await supabase.from('native_push_tokens').delete().eq('user_id', uid)
    try { await PN.removeAllListeners() } catch { /* 무시 */ }
  } catch { /* 무시 */ }
}
