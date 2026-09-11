// 네이티브(Capacitor) 앱 푸시 — FCM 토큰 등록·저장.
//   웹/PWA 는 Web Push(lib/push.js)를 그대로 쓴다. 네이티브만 이 경로.
//   FCM 토큰을 native_push_tokens 테이블(마이그 259)에 저장 → send-push Edge Function 이 FCM 발송.
import { supabase } from '../supabaseClient'
import { isNativeApp } from './installPrompt'
// 정적 import — 동적 import(+Vite 프리로드 12개 의존 청크 대기)가 네이티브 WebView 에서 영원히 안 끝나
//   "켜는 중" 멈춤을 만드는 것으로 의심돼 교체. 웹에선 프록시 등록만 되고 호출 전까지 네이티브 접근 없음(무해).
import { PushNotifications } from '@capacitor/push-notifications'

// ⚠️ Capacitor 플러그인(PushNotifications)은 Proxy 라 «어떤 속성이든» 네이티브 메서드로 취급한다 —
//   `then` 도 예외가 아니어서(@capacitor/core registerPlugin get 트랩은 $$typeof/toJSON 만 특별처리),
//   async 함수에서 `return PushNotifications` 하거나 `await PushNotifications` 하면 JS 가 thenable 로 오인해
//   존재하지 않는 네이티브 `then()` 을 호출하고 그 promise 는 «영원히» 안 끝난다(에러도 없음).
//   → 예전 `async getPlugin(){ return PushNotifications }` 가 "켜는 중" 무한 멈춤의 진짜 원인(2026-09-11 확정).
//   플러그인은 반드시 정적 바인딩을 «직접» 쓰고, 절대 promise 로 감싸 반환/await/resolve 하지 말 것.

export function nativePushSupported() {
  return isNativeApp()
}

// 마지막 실패 원인 — 설정 화면이 «왜 unsupported 인지» 글자로 보여주는 데 사용(진단·안내용).
//   기존엔 catch 가 원인을 삼켜 "곧 지원될 예정"만 떠서 원인 추적이 불가능했음.
let _lastErr = ''
export function getLastNativePushError() { return _lastErr }

// 구독 진행 단계 — "켜는 중" 멈춤 시 어느 단계인지 문구에 남기기 위함(진단·안내용).
let _stage = ''
export function getLastNativePushStage() { return _stage }

// 현재 권한 상태: 'granted' | 'denied' | 'prompt' | 'unsupported'
//   ⚠️ 8초 타임아웃 — 브리지 호출이 영원히 안 끝나면(실기기에서 발생) state 가 loading 에 갇혀 토글이
//   무반응이 됨. 멈춘 «단계»(import / checkPermissions)를 문구에 남겨 원인을 구분한다.
export async function getNativePushPermission() {
  if (!isNativeApp()) return 'unsupported'
  let stage = 'import'
  let timer
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error(`응답 없음(8초) @${stage}`)), 8000)
  })
  try {
    const p = await Promise.race([
      (async () => {
        const PN = PushNotifications; stage = 'checkPermissions'
        const r = await PN.checkPermissions(); stage = 'done'
        return r
      })(),
      timeout,
    ])
    _lastErr = ''
    return p.receive // 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'
  } catch (e) {
    _lastErr = `${String(e?.message || e)} [${stage}]`
    return 'unsupported'
  } finally {
    clearTimeout(timer)
  }
}

// 권한 요청 → register → FCM 토큰 수신 → native_push_tokens 저장. (내부 구현 — 외부는 아래 subscribeNativePush 래퍼 사용)
async function subscribeNativePushInner() {
  if (!isNativeApp()) throw new Error('네이티브 앱에서만 사용할 수 있어요.')
  const PN = PushNotifications // 직접 참조 — await/return 금지(상단 thenable 함정 주석)

  _stage = 'checkPermissions'
  let perm = await PN.checkPermissions()
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    _stage = 'requestPermissions'
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
    _stage = 'register'
    await PN.register()
    _stage = 'awaitToken'
    token = await tokPromise
  } finally {
    clearTimeout(timer)
    try { await regH.remove() } catch { /* 무시 */ }
    try { await errH.remove() } catch { /* 무시 */ }
  }
  if (!token) throw new Error('푸시 토큰을 받지 못했어요.')

  // ⚠️ getUser() 대신 getSession() — getUser 는 매번 /auth/v1/user 로 «네트워크 왕복»을 해서
  //   노트9 등에서 이 호출이 지연되면 "켜는 중"이 멈춤. uid 는 로컬 세션으로 충분하다(네트워크 불필요).
  _stage = 'getSession'
  const { data: s } = await supabase.auth.getSession()
  const uid = s?.session?.user?.id
  if (!uid) throw new Error('로그인이 필요해요.')

  _stage = 'upsert'
  const { error } = await supabase
    .from('native_push_tokens')
    .upsert({ user_id: uid, token, platform: 'android', updated_at: new Date().toISOString() }, { onConflict: 'token' })
  if (error) throw error
  _stage = 'done'
  return token
}

// 전체 타임아웃 가드 — 플러그인 로드·권한 요청 구간은 위 15초(토큰) 타이머 «밖»이라, 거기서 멈추면
//   promise 가 영원히 안 끝나 UI 가 "켜는 중"에 갇힘(code 4 에서 실제 발생). 어떤 단계에서 멈춰도
//   25초 안에 반드시 끝나게 race → 호출부 finally 가 busy 를 풀고 안내 문구를 띄운다.
export function subscribeNativePush() {
  _stage = 'start'
  let timer
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error(`알림 켜기가 지연되고 있어요 (${_stage}단계). 앱을 완전히 종료한 뒤 다시 시도해주세요.`)), 25000)
  })
  return Promise.race([subscribeNativePushInner(), timeout]).finally(() => clearTimeout(timer))
}

// 수신 리스너 — 포그라운드 도착(pushNotificationReceived) → 'dodam:push' CustomEvent(앱 배너가 표시),
//   알림 탭(pushNotificationActionPerformed) → 'dodam:push-open'(링크 이동). 한 번만 배선(중복 방지).
//   addListener 의 반환(핸들 promise)은 await 해도 안전 — 플러그인 Proxy 자체를 promise 로 넘기지 않음.
let _listenersInited = false
export async function initNativePushListeners() {
  if (_listenersInited || !isNativeApp()) return
  _listenersInited = true
  try {
    await PushNotifications.addListener('pushNotificationReceived', (n) => {
      window.dispatchEvent(new CustomEvent('dodam:push', { detail: { title: n?.title, body: n?.body, link: n?.data?.link } }))
    })
    await PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
      const link = a?.notification?.data?.link
      if (link) window.dispatchEvent(new CustomEvent('dodam:push-open', { detail: { link } }))
    })
  } catch { _listenersInited = false }
}

// 구독 해제 — 이 기기 토큰 삭제 (+ 로컬 리스너 제거).
export async function unsubscribeNativePush() {
  if (!isNativeApp()) return
  try {
    const PN = PushNotifications
    // 저장된 토큰을 정확히 지우려면 최근 토큰이 필요하나, 간단히 이 사용자 토큰 전부 삭제.
    const { data: s } = await supabase.auth.getSession()
    const uid = s?.session?.user?.id
    if (uid) await supabase.from('native_push_tokens').delete().eq('user_id', uid)
    try { await PN.removeAllListeners() } catch { /* 무시 */ }
  } catch { /* 무시 */ }
}
