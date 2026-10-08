// 네이티브(Capacitor) 전용 소셜 로그인 — OAuth 를 «시스템 브라우저(Custom Tab)» 에서 열고
//   딥링크(com.healthplatform.app://auth/callback)로 앱에 복귀시킨다.
//   ⚠️ 웹/PWA 는 이 파일을 쓰지 않는다(기존 리다이렉트 방식 유지). 호출 측에서 isNativeApp() 로 분기.
//
// 왜 필요한가: 네이티브는 내장 웹뷰라 (1) 구글이 웹뷰 OAuth 를 정책 차단하고
//   (2) origin 이 https://localhost 라 redirect_uri 가 성립 안 함. → 시스템 브라우저 + 딥링크로 우회.
//
// 세 갈래
//   · 구글 1차(2026-10-08, 본인 결정 ⓑ): **ID 토큰 방식** — Credential Manager 가 띄우는 네이티브 계정 선택창
//     → ID 토큰 → supabase.auth.signInWithIdToken. 웹의 GIS 버튼과 같은 방식이라 동의 화면에
//     «xxxx.supabase.co 로 이동» 같은 Supabase 도메인이 안 보인다(그 도메인이 보이던 것이 이 변경의 이유).
//     구글 콘솔에 Android OAuth 클라이언트(패키지명 + 서명 SHA-1)가 등록돼 있어야 뜬다.
//   · 구글 2차(안전망): 1차가 실패하면(콘솔 미등록·Play 서비스 없음·토큰 거절) 예전 Custom Tab + 딥링크 방식.
//     사용자가 «취소»한 경우는 폴백하지 않는다 — 취소했는데 또 다른 창이 뜨면 안 된다.
//   · 카카오·네이버(2026-10-08): provider 가 https redirect_uri 만 받아서 딥링크로 직접 못 온다 →
//     «라이브 웹의 /auth/callback» 으로 보내고, 그 페이지가 code 를 딥링크로 튕겨 준다(bounce).
//     검증(nonce)·교환(Edge Function)·verifyOtp 는 전부 앱 안에서 한다. 웹 페이지는 code 를 쓰지 않는다
//     (code 는 1회용 — 웹이 써 버리면 앱이 못 쓴다).
//
// ⚠️ 딥링크는 두 길로 들어온다.
//   · 따뜻한 복귀: 앱이 살아 있고 waitForDeepLink 가 기다리는 중 → 그 waiter 가 처리.
//   · 차가운 복귀: 카카오톡·크롬으로 갔다 오는 사이 앱 프로세스가 죽어 딥링크가 앱을 «새로» 띄움 →
//     waiter 가 없다. 이때는 hooks/useNativeAuthReturn 이 getLaunchUrl/appUrlOpen 으로 받아
//     같은 handleNativeAuthUrl 로 마무리한다. nonce 는 localStorage 라 프로세스가 죽어도 남는다.
import { Browser } from '@capacitor/browser'
import { App } from '@capacitor/app'
import { SocialLogin } from '@capgo/capacitor-social-login'
import { supabase } from '../supabaseClient'
import { startOAuthState, parseOAuthState, verifyOAuthNonce } from './oauthState'
import {
  NATIVE_SCHEME, NATIVE_REDIRECT, WEB_AUTH_CALLBACK, PROVIDER_LABEL,
  buildProviderAuthorizeUrl, completeProviderLogin,
} from './socialAuthUrls'

export { NATIVE_SCHEME, NATIVE_REDIRECT }

// 우리 딥링크인가 (com.healthplatform.app://auth/callback…)
export const isNativeAuthUrl = (url) => typeof url === 'string' && url.startsWith(NATIVE_REDIRECT)

// 지금 waiter 가 기다리는 중인가 — 전역 처리기(useNativeAuthReturn)가 같은 URL 을 두 번 처리하지 않게.
let waiting = false
export const isAwaitingNativeAuth = () => waiting

// 딥링크 복귀를 1회 기다린다 — appUrlOpen 으로 우리 스킴 URL 이 오면 resolve.
function waitForDeepLink(timeoutMs = 120000) {
  waiting = true
  return new Promise((resolve, reject) => {
    let done = false
    let handle
    const finish = (fn, arg) => {
      if (done) return
      done = true
      waiting = false
      try { handle?.remove?.() } catch { /* 무시 */ }
      fn(arg)
    }
    App.addListener('appUrlOpen', ({ url }) => {
      if (url && url.startsWith(`${NATIVE_SCHEME}://`)) finish(resolve, url)
    }).then((h) => {
      handle = h
      // 리스너 등록 전에 이미 복귀했을 가능성은 낮지만, 등록 완료 후 대기.
    })
    setTimeout(() => finish(reject, new Error('로그인 시간이 초과됐어요. 다시 시도해주세요.')), timeoutMs)
  })
}

// 복귀 URL(code=PKCE 또는 hash token)에서 세션을 완성한다. (구글 2차 — Supabase 호스팅 OAuth)
async function completeSessionFromUrl(cbUrl) {
  const u = new URL(cbUrl)
  const code = u.searchParams.get('code')
  const hash = u.hash?.startsWith('#') ? u.hash.slice(1) : ''
  const hp = new URLSearchParams(hash)

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw error
    return
  }
  const access_token = hp.get('access_token')
  const refresh_token = hp.get('refresh_token')
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    if (error) throw error
    return
  }
  const errDesc = u.searchParams.get('error_description') || hp.get('error_description')
  throw new Error(errDesc || '로그인을 완료하지 못했어요.')
}

// 돌아온 딥링크 하나를 끝까지 처리한다 — 따뜻한 복귀(waiter)와 차가운 복귀(전역 처리기)가 같이 쓴다.
//   카카오·네이버(bounce): ?provider&code&state → nonce 검증 → Edge Function → verifyOtp
//   구글 2차(Supabase OAuth): ?code(PKCE) 또는 #access_token → 세션
//   돌려주는 값: 처리한 provider 이름. 실패는 사용자에게 보여 줄 문구의 Error 로 던진다.
export async function handleNativeAuthUrl(cbUrl) {
  const u = new URL(cbUrl)
  const provider = u.searchParams.get('provider')
  const err = u.searchParams.get('error')
  if (!provider) {
    // 구글 2차(Supabase 호스팅) — provider 파라미터 없이 code/hash 로 온다
    await completeSessionFromUrl(cbUrl)
    return 'google'
  }
  const label = PROVIDER_LABEL[provider] || provider
  if (err) throw new Error(u.searchParams.get('error_description') || `${label} 로그인이 취소됐어요`)

  const code = u.searchParams.get('code')
  const backState = u.searchParams.get('state')
  const parsed = parseOAuthState(backState)
  if (!code || !parsed || parsed.provider !== provider) {
    throw new Error('로그인 정보가 없어요. 다시 시도해주세요.')
  }
  // CSRF — 우리가 보낸 nonce 와 같아야 한다. 웹 콜백은 이 값을 볼 수 없어 검증을 앱에 넘겼다.
  const check = verifyOAuthNonce(parsed.nonce)
  if (check !== 'ok') throw new Error('보안 검증에 실패했어요 — 다시 시도해주세요')

  await completeProviderLogin({ provider, code, state: backState, redirectUri: WEB_AUTH_CALLBACK })
  return provider
}

// ─── 구글 1차: ID 토큰 ────────────────────────────────────────────────────────────
// Supabase 의 nonce 규칙(애플과 같다): 토큰엔 sha256(raw) 가 들어가고, signInWithIdToken 엔 raw 를 준다.
//   crypto.subtle 이 없으면 nonce 없이 간다 — Supabase 는 토큰에 nonce 가 없으면 검사하지 않는다.
let googleReady = false
async function ensureGoogleInit() {
  if (googleReady) return
  const webClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!webClientId) throw new Error('VITE_GOOGLE_CLIENT_ID 없음')
  // webClientId 는 반드시 «웹» 클라이언트 ID — Supabase 구글 제공자에 등록된 그 값(토큰의 aud 가 된다).
  await SocialLogin.initialize({ google: { webClientId, mode: 'online' } })
  googleReady = true
}
function randomNonce() {
  try { if (crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, '') } catch { /* 미지원 */ }
  return String(Math.random()).slice(2) + String(Date.now())
}
async function sha256Hex(str) {
  try {
    if (!crypto?.subtle) return null
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch { return null }
}
const isUserCancel = (e) => /cancel|취소|dismiss|closed/i.test(String(e?.message || e?.code || e || ''))

async function googleIdTokenSignIn() {
  await ensureGoogleInit()
  const raw = randomNonce()
  const hashed = await sha256Hex(raw)
  // ⚠️ scopes 를 주지 않는다 — 플러그인은 scopes 가 있으면 «구식 GoogleSignIn 경로»로 가며 MainActivity 수정을
  //   요구하고, 없으면 즉시 실패시킨다("You CANNOT use scopes without modifying the main activity", 2026-10-08 폰에서 확인).
  //   scopes 없이 가면 Credential Manager(계정 선택창) 경로. 이메일·이름·사진은 ID 토큰 안에 이미 들어 있다.
  const res = await SocialLogin.login({
    provider: 'google',
    options: { ...(hashed ? { nonce: hashed } : {}) },
  })
  const idToken = res?.result?.idToken
  if (!idToken) throw new Error('ID 토큰이 없어요')
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
    ...(hashed ? { nonce: raw } : {}),
  })
  if (error) throw error
}

// ─── 구글 2차: Supabase 호스팅 OAuth (Custom Tab + 딥링크) ─────────────────────────
//   ⚠️ Supabase 대시보드 Auth → URL Configuration → Redirect URLs 에 NATIVE_REDIRECT 가 등록돼 있어야 동작.
async function googleCustomTabSignIn() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true },
  })
  if (error) throw error
  if (!data?.url) throw new Error('OAuth 주소 생성에 실패했어요.')

  const waiter = waitForDeepLink()
  await Browser.open({ url: data.url })   // 시스템 브라우저(Custom Tab)
  const cbUrl = await waiter
  try { await Browser.close() } catch { /* 이미 닫힘 */ }
  await handleNativeAuthUrl(cbUrl)
}

// 구글 — 네이티브 로그인. 1차(ID 토큰) → 실패 시 2차(Custom Tab). 취소는 폴백 없이 그대로 알린다.
export async function nativeGoogleSignIn() {
  try {
    await googleIdTokenSignIn()
    return
  } catch (e) {
    if (isUserCancel(e)) throw new Error('Google 로그인이 취소됐어요', { cause: e })
    // 콘솔 미등록(28444/10)·Play 서비스 없음·토큰 거절 등 — 로그로 남기고 예전 방식으로
    console.warn('[nativeGoogleSignIn] ID 토큰 방식 실패 → Custom Tab 으로 폴백:', e?.message || e)
  }
  await googleCustomTabSignIn()
}

// 카카오·네이버 — 네이티브 로그인(bounce).
//   1) state 에 native 표시 + nonce(앱 localStorage) → authorize 를 Custom Tab 으로
//   2) provider → https://…/auth/callback(웹) → 그 페이지가 딥링크로 code·state 를 돌려줌
//   3) 앱: nonce 검증 → Edge Function(code→token_hash) → verifyOtp  (handleNativeAuthUrl)
//   앱이 그 사이 죽었다 다시 뜨면 waiter 는 없고 useNativeAuthReturn 이 3)을 대신한다.
export async function nativeProviderSignIn(provider) {
  const label = PROVIDER_LABEL[provider] || provider
  const state = startOAuthState(provider, { native: true })
  const url = buildProviderAuthorizeUrl(provider, { redirectUri: WEB_AUTH_CALLBACK, state })
  if (!url) throw new Error(`${label} 로그인 설정이 누락됐어요. 잠시 후 다시 시도해주세요.`)

  const waiter = waitForDeepLink()
  await Browser.open({ url })
  const cbUrl = await waiter
  try { await Browser.close() } catch { /* 이미 닫힘 */ }
  await handleNativeAuthUrl(cbUrl)
}
