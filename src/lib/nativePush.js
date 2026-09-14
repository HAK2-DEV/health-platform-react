// 네이티브(Capacitor) 앱 푸시 — FCM 토큰 «등록·소유권·회전» 관리.
//   웹/PWA 는 Web Push(lib/push.js)를 그대로 쓴다. 네이티브만 이 경로.
//   저장: native_push_tokens(마이그 259) · 소유권 이전: RPC claim_native_push_token(마이그 260).
//
//   설계 핵심 — «이 기기의 FCM 토큰이 지금 누구 것인가»를 항상 명확히 한다:
//   · FCM 토큰은 «앱 설치 단위»라 계정이 바뀌어도 같다 → 계정 전환 시 소유권 이전이 정상 흐름.
//     클라이언트 권한으론 타인 행을 못 지우므로 서버 RPC(260)가 「타인 행 삭제 후 내 것으로」 처리.
//   · 토글의 «켜짐» 판정은 OS 권한이 아니라 «이 기기 토큰이 DB(내 소유)에 있는가» 로 한다.
//     안드로이드 12 이하는 플러그인이 권한을 «무조건 granted» 로 답하기 때문(플러그인 소스 확인).
//   · 토큰 회전(재설치·복원 등)은 상시 registration 리스너가 받아 DB 에 반영한다.
import { supabase } from '../supabaseClient'
import { isNativeApp } from './installPrompt'
// 정적 import — 동적 import(+Vite 프리로드 의존 청크 대기)가 네이티브 WebView 에서 안 끝나는 사례가 있어 고정.
import { PushNotifications } from '@capacitor/push-notifications'

// ⚠️ Capacitor 플러그인(PushNotifications)은 Proxy 라 «어떤 속성이든» 네이티브 메서드로 취급한다 —
//   `then` 도 예외가 아니어서(@capacitor/core registerPlugin get 트랩은 $$typeof/toJSON 만 특별처리),
//   async 함수에서 `return PushNotifications` 하거나 `await PushNotifications` 하면 JS 가 thenable 로 오인해
//   존재하지 않는 네이티브 `then()` 을 호출하고 그 promise 는 «영원히» 안 끝난다(에러도 없음).
//   → 예전 `async getPlugin(){ return PushNotifications }` 가 "켜는 중" 무한 멈춤의 진짜 원인(2026-09-11 확정).
//   플러그인은 반드시 정적 바인딩을 «직접» 쓰고, 절대 promise 로 감싸 반환/await/resolve 하지 말 것.

const TOKEN_KEY = 'dodam-native-push-token'  // 이 기기의 마지막 FCM 토큰
const OPTIN_KEY = 'dodam-native-push-optin'  // 사용자가 «직접» 켰는지(안드 ≤12 는 권한이 항상 granted 라 구분 필요)

// localStorage 는 프라이빗 모드·정책에 따라 접근 자체가 throw 할 수 있어 전부 감싼다.
const ls = {
  get(k) { try { return localStorage.getItem(k) } catch { return null } },
  set(k, v) { try { localStorage.setItem(k, v) } catch { /* 무시 */ } },
  del(k) { try { localStorage.removeItem(k) } catch { /* 무시 */ } },
}

export function nativePushSupported() {
  return isNativeApp()
}

// 마지막 실패 원인 — «진단용». 사용자 화면에는 노출하지 않는다(내부 단계명·영문 원문이 새어 나갔던 문제).
let _lastErr = ''
export function getLastNativePushError() { return _lastErr }

const withTimeout = (p, ms, label) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error(`응답 없음(${ms}ms) @${label}`)), ms)),
])

async function currentUid() {
  // getSession()=로컬 저장소(네트워크 왕복 없음). getUser() 는 매번 /auth/v1/user 를 호출해 느린 기기에서 멈춘다.
  const { data } = await supabase.auth.getSession()
  return data?.session?.user?.id ?? null
}

// 토큰을 «내 것으로» 확정 — 타인 소유였어도 RPC 가 이전시킨다.
async function claimToken(token) {
  const { error } = await supabase.rpc('claim_native_push_token', { p_token: token, p_platform: 'android' })
  if (error) throw error
  ls.set(TOKEN_KEY, token)
}

// 토글 표시용 상태: 'subscribed' | 'unsubscribed' | 'denied' | 'unsupported'
//   ⚠️ OS 권한만으로 판정하지 않는다 — 안드 ≤12 는 항상 'granted' 라 «토큰이 없는데 켜짐» 으로 보였다.
//   RLS 덕분에 «내 소유가 아닌 토큰» 은 조회에서 0행으로 나와, 계정 전환 기기도 자동으로 '꺼짐' 이 된다.
export async function getNativePushState() {
  if (!isNativeApp()) return 'unsupported'
  try {
    const perm = await withTimeout(PushNotifications.checkPermissions(), 8000, 'checkPermissions')
    if (perm?.receive === 'denied') return 'denied'
    const uid = await currentUid()
    if (!uid) return 'unsubscribed'
    const token = ls.get(TOKEN_KEY)
    if (!token) {
      // 로컬 토큰 기록이 없다 = «신규 설치» 이거나 «이 키가 없던 구버전에서 업데이트» 한 경우.
      //   후자는 DB 에 내 소유 토큰이 그대로 남아 서버는 계속 발송하는데 화면만 '꺼짐' 으로 보인다.
      //   → DB 를 보고 «이미 켠 기기» 로 복구하고 OPTIN 을 세운다(다음 ensureNativePushRegistered 가
      //   현재 토큰을 로컬에 다시 채워 이후부터는 기기 단위로 정확히 판정된다).
      const { data: mine, error: e2 } = await supabase
        .from('native_push_tokens')
        .select('id')
        .eq('user_id', uid)
        .limit(1)
      if (e2) throw e2
      if (mine && mine.length > 0) {
        ls.set(OPTIN_KEY, '1')
        _lastErr = ''
        return 'subscribed'
      }
      return 'unsubscribed'
    }
    const { data, error } = await supabase
      .from('native_push_tokens')
      .select('id')
      .eq('token', token)
      .limit(1)
    if (error) throw error
    _lastErr = ''
    return (data && data.length > 0) ? 'subscribed' : 'unsubscribed'
  } catch (e) {
    _lastErr = String(e?.message || e)
    return 'unsupported'
  }
}

// register() → 'registration' 이벤트로 토큰 수신. 리스너를 «완전히 붙인 뒤» register 해야 이벤트를 안 놓친다.
async function requestToken() {
  let done = false
  let resolveTok, rejectTok
  const finish = (fn, arg) => { if (!done) { done = true; fn(arg) } }
  const tokPromise = new Promise((res, rej) => { resolveTok = res; rejectTok = rej })
  const regH = await PushNotifications.addListener('registration', (t) => finish(resolveTok, t?.value))
  const errH = await PushNotifications.addListener('registrationError', (e) => finish(rejectTok, new Error(e?.error || '푸시 등록에 실패했어요.')))
  const timer = setTimeout(() => finish(rejectTok, new Error('푸시 토큰을 받는 데 시간이 걸리고 있어요. 잠시 후 다시 시도해주세요.')), 15000)
  try {
    await PushNotifications.register()
    return await tokPromise
  } finally {
    clearTimeout(timer)
    try { await regH.remove() } catch { /* 무시 */ }
    try { await errH.remove() } catch { /* 무시 */ }
  }
}

async function subscribeNativePushInner() {
  if (!isNativeApp()) throw new Error('네이티브 앱에서만 사용할 수 있어요.')

  let perm = await PushNotifications.checkPermissions()
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions()
  }
  if (perm.receive !== 'granted') {
    throw new Error('알림 권한이 꺼져 있어요. 설정 > 앱 > 도담 > 알림에서 허용해주세요.')
  }

  const uid = await currentUid()
  if (!uid) throw new Error('로그인이 필요해요.')

  const token = await requestToken()
  if (!token) throw new Error('푸시 토큰을 받지 못했어요.')

  await claimToken(token)
  ls.set(OPTIN_KEY, '1')   // 사용자가 «직접» 켠 기기로 표시 → 이후 앱 기동 시 자동 재등록 대상
  return token
}

// 전체 타임아웃 가드 — 어느 단계에서 멈춰도 25초 안에 반드시 끝나 UI 가 "켜는 중"에 갇히지 않게 한다.
//   (내부 단계명은 사용자 문구에 넣지 않는다 — 진단은 getLastNativePushError 로.)
export function subscribeNativePush() {
  let timer
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error('알림 켜기가 지연되고 있어요. 앱을 완전히 종료한 뒤 다시 시도해주세요.')), 25000)
  })
  return Promise.race([subscribeNativePushInner(), timeout])
    .catch((e) => { _lastErr = String(e?.message || e); throw e })
    .finally(() => clearTimeout(timer))
}

// 상시 리스너 — 앱 생애주기 동안 한 번만 배선.
//   · registration : 토큰 «회전» 대응. 켠 사용자(OPTIN)면 DB 에 즉시 반영한다.
//   · received/actionPerformed : 포그라운드 배너 표시 / 알림 탭 시 링크 이동.
let _listenersInited = false
export async function initNativePushListeners() {
  if (_listenersInited || !isNativeApp()) return
  _listenersInited = true
  try {
    await PushNotifications.addListener('registration', (t) => {
      const token = t?.value
      if (!token) return
      ls.set(TOKEN_KEY, token)
      if (ls.get(OPTIN_KEY) === '1') claimToken(token).catch((e) => { _lastErr = String(e?.message || e) })
    })
    await PushNotifications.addListener('pushNotificationReceived', (n) => {
      window.dispatchEvent(new CustomEvent('dodam:push', { detail: { title: n?.title, body: n?.body, link: n?.data?.link } }))
    })
    await PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
      const link = a?.notification?.data?.link
      if (link) window.dispatchEvent(new CustomEvent('dodam:push-open', { detail: { link } }))
    })
  } catch (e) {
    _listenersInited = false
    _lastErr = String(e?.message || e)
  }
}

// 앱 기동·로그인 후 멱등 재등록 — 토큰이 바뀌었거나(재설치·복원) 소유가 넘어갔어도 다시 «내 것» 으로 맞춘다.
//   ⚠️ 사용자가 직접 켠 기기(OPTIN)에서만 동작. 안드 ≤12 는 권한이 항상 granted 라, 이 가드가 없으면
//   알림을 원치 않은 사용자에게도 토큰이 등록돼 버린다.
export async function ensureNativePushRegistered() {
  if (!isNativeApp() || ls.get(OPTIN_KEY) !== '1') return
  try {
    const uid = await currentUid()
    if (!uid) return
    const perm = await PushNotifications.checkPermissions()
    if (perm?.receive !== 'granted') return
    await initNativePushListeners()      // registration 리스너가 붙은 뒤에 register 해야 토큰을 받는다
    await PushNotifications.register()   // 멱등 — 결과 토큰은 상시 리스너가 claim
  } catch (e) {
    _lastErr = String(e?.message || e)
  }
}

// 구독 해제 — «이 기기» 토큰만 삭제한다(다른 기기 알림은 유지).
//   ⚠️ removeAllListeners() 를 부르지 않는다 — 포그라운드 배너·알림 탭 리스너까지 지워져
//   같은 세션에서 OFF→ON 한 뒤 배너가 안 뜨던 문제가 있었다.
export async function unsubscribeNativePush() {
  if (!isNativeApp()) return
  try {
    const token = ls.get(TOKEN_KEY)
    if (token) {
      await supabase.from('native_push_tokens').delete().eq('token', token)
    } else {
      // 로컬 토큰을 모르는 구버전 설치 — 이 사용자 토큰 전부 정리(폴백)
      const uid = await currentUid()
      if (uid) await supabase.from('native_push_tokens').delete().eq('user_id', uid)
    }
  } catch (e) {
    _lastErr = String(e?.message || e)
  } finally {
    ls.del(OPTIN_KEY)   // 토큰 문자열은 남겨 둔다(같은 기기 재구독 시 그대로 claim)
  }
}
