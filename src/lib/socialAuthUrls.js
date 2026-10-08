// 카카오·네이버 커스텀 OAuth 의 «공통 부품» — 웹(SocialAuthButtons→AuthCallbackPage)과
//   네이티브(nativeOAuth)가 같은 authorize 주소·같은 완료 절차를 쓰게 한 자리.
//   둘이 따로 조립하면 scope 하나, redirect_uri 한 글자가 어긋나는 순간 한쪽만 깨진다(KOE006 류).
//
// 흐름(둘 다 같다)
//   authorize(이 파일) → provider 가 code+state 를 redirect_uri 로 돌려줌
//   → completeProviderLogin(이 파일): Edge Function(code→token_hash) → verifyOtp → 세션
//   다른 점은 «code 를 누가 받느냐» 뿐 — 웹은 /auth/callback 페이지가, 네이티브는 그 페이지가
//   딥링크로 튕겨 준 것을 앱이 받는다(bounce). 그래서 Capacitor 를 여기서 import 하지 않는다.
import { supabase } from '../supabaseClient'

// 네이티브 앱 딥링크(AndroidManifest intent-filter + strings.xml custom_url_scheme 과 일치)
export const NATIVE_SCHEME = 'com.healthplatform.app'
export const NATIVE_REDIRECT = `${NATIVE_SCHEME}://auth/callback`

// 라이브 웹 주소 — 네이티브는 origin 이 https://localhost 라 redirect_uri 로 쓸 수 없어서 라이브 도메인을 빌려 쓴다.
export const WEB_ORIGIN = import.meta.env.VITE_WEB_ORIGIN || 'https://healthplatform-pi.vercel.app'
// 네이티브 복귀 주소 = «서버 함수»(api/native-return.mjs) — SPA 페이지(/auth/callback)가 아니다. (2026-10-08 폰 재현 뒤 결정)
//   · SPA 로 받으면 두 가지가 막는다: ① 폰 브라우저(크롬·삼성 인터넷 각각)에 남은 옛 PWA 서비스워커가 옛 index 를 내줘
//     빈 화면/옛 페이지가 뜬다 ② JS 로 앱 스킴에 보내는 건 크롬이 «제스처 없는 앱 전환» 으로 막는다.
//   · /api/ 는 처음부터 서비스워커 제외 경로라 옛 서비스워커도 못 건드리고, 서버가 302 로 앱 스킴을 주면 크롬이
//     사용자 내비게이션 사슬로 보고 앱을 바로 연다(Supabase 호스팅 OAuth 가 구글 로그인에서 쓰는 방식).
//   ⚠️ 카카오 Redirect URI · 네이버 Callback URL 에 이 주소가 등록돼 있어야 한다(둘 다 여러 개 등록 가능).
export const WEB_AUTH_CALLBACK = `${WEB_ORIGIN}/api/native-return`

export const PROVIDER_FN = {
  kakao: 'kakao-oauth',
  naver: 'naver-oauth',
}
export const PROVIDER_LABEL = { kakao: 'Kakao', naver: 'Naver' }

// authorize 주소. 설정이 비어 있으면 null — 호출 측이 안내한다.
//   Kakao: scope 는 profile_nickname·profile_image 뿐(이메일은 비즈 앱 권한) → 가상 이메일로 가입.
//   Naver: state 필수(CSRF). 둘 다 redirect_uri 는 쿼리 없이 path-only(카카오가 쿼리를 떼는 경우가 있다).
export function buildProviderAuthorizeUrl(provider, { redirectUri, state }) {
  if (provider === 'kakao') {
    const clientId = import.meta.env.VITE_KAKAO_REST_API_KEY
    if (!clientId) return null
    const p = new URLSearchParams({
      response_type: 'code', client_id: clientId, redirect_uri: redirectUri,
      scope: 'profile_nickname profile_image', state,
    })
    return `https://kauth.kakao.com/oauth/authorize?${p}`
  }
  if (provider === 'naver') {
    const clientId = import.meta.env.VITE_NAVER_CLIENT_ID
    if (!clientId) return null
    const p = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, state })
    return `https://nid.naver.com/oauth2.0/authorize?${p}`
  }
  return null
}

// code → 세션. Edge Function 이 provider 토큰을 교환하고 magiclink token_hash 를 돌려주면 verifyOtp 로 로그인.
//   redirectUri 는 authorize 때 쓴 것과 «같아야» 한다(provider 가 토큰 교환 때 대조).
//   state 는 네이버 토큰 교환에 필요(카카오 함수는 무시) → 늘 동봉.
export async function completeProviderLogin({ provider, code, state, redirectUri }) {
  const fnName = PROVIDER_FN[provider]
  if (!fnName) throw new Error(`아직 지원하지 않는 provider: ${provider}`)

  const { data, error } = await supabase.functions.invoke(fnName, {
    body: { code, redirect_uri: redirectUri, state },
  })
  if (error) {
    // FunctionsHttpError 는 본문에 우리 쪽 에러 문구가 있다
    let detail = error.message
    if (error?.context && typeof error.context.json === 'function') {
      try { const body = await error.context.json(); if (body?.error) detail = body.error } catch { /* 기본 문구 유지 */ }
    } else if (data?.error) {
      detail = data.error
    }
    throw new Error(detail)
  }
  if (!data?.email || !data?.token_hash) throw new Error('서버 응답에 필수 필드가 없어요')

  // token_hash 사용 시 email 동봉 금지 ("Only the token_hash and type should be provided")
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: data.token_hash,
    type: data.verification_type ?? 'magiclink',
  })
  if (verifyErr) throw verifyErr
}
