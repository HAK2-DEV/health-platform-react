// 네이티브(Capacitor) 전용 소셜 로그인 — OAuth 를 «시스템 브라우저(Custom Tab)» 에서 열고
//   딥링크(com.healthplatform.app://auth/callback)로 앱에 복귀시킨다.
//   ⚠️ 웹/PWA 는 이 파일을 쓰지 않는다(기존 리다이렉트 방식 유지). 호출 측에서 isNativeApp() 로 분기.
//
// 왜 필요한가: 네이티브는 내장 웹뷰라 (1) 구글이 웹뷰 OAuth 를 정책 차단하고
//   (2) origin 이 https://localhost 라 redirect_uri 가 성립 안 함. → 시스템 브라우저 + 딥링크로 우회.
import { Browser } from '@capacitor/browser'
import { App } from '@capacitor/app'
import { supabase } from '../supabaseClient'

// 딥링크 스킴(AndroidManifest intent-filter + strings.xml custom_url_scheme 과 일치)
export const NATIVE_SCHEME = 'com.healthplatform.app'
export const NATIVE_REDIRECT = `${NATIVE_SCHEME}://auth/callback`

// 딥링크 복귀를 1회 기다린다 — appUrlOpen 으로 우리 스킴 URL 이 오면 resolve.
function waitForDeepLink(timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    let done = false
    let handle
    const finish = (fn, arg) => {
      if (done) return
      done = true
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

// 복귀 URL(code=PKCE 또는 hash token)에서 세션을 완성한다.
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

// 구글 (Supabase OAuth) — 네이티브 로그인.
//   ⚠️ Supabase 대시보드 Auth → URL Configuration → Redirect URLs 에 NATIVE_REDIRECT 를 등록해야 동작.
export async function nativeGoogleSignIn() {
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
  await completeSessionFromUrl(cbUrl)
}
