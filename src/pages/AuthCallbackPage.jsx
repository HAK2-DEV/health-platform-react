import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, AlertCircle, Smartphone } from 'lucide-react'
import { parseOAuthState, verifyOAuthNonce } from '../lib/oauthState'
import { NATIVE_REDIRECT, PROVIDER_FN, PROVIDER_LABEL, completeProviderLogin } from '../lib/socialAuthUrls'

// Day 65 — 소셜 OAuth callback 처리 페이지.
// Kakao/Naver 등 커스텀 OAuth 흐름에서 provider 가 이 경로로 code 를 돌려줌.
// 라우트: /auth/callback?code=...&state=provider.nonce[.native]
//
// 흐름(웹)
//   1) state 에서 provider 판별 + nonce(CSRF) 검증
//   2) completeProviderLogin — Edge Function → verifyOtp → 세션
//   3) HomePage 진입 → nickname 체크 → /nickname-setup 자동 이동 (기존 흐름)
//
// 흐름(네이티브 앱에서 시작한 로그인, state 끝에 .native — 2026-10-08)
//   이 페이지는 앱의 저장소를 볼 수 없다(nonce 없음) + 여기서 세션을 만들어도 앱엔 없다.
//   → 검증·교환 없이 code·state 를 앱 딥링크로 «튕겨만» 준다. code 는 1회용이라 여기서 쓰면 앱이 못 쓴다.
//
// Google 은 Supabase 기본 OAuth 라 자동 처리 — 이 페이지 거치지 않음.

// 하위호환 — 이전 버전(provider 를 sessionStorage 로 넘기던 방식)으로 시작된 로그인 구제.
//   새 방식이 자리 잡으면(배포 후 몇 분) 항상 null 이 된다.
function readAndClearLegacyProvider() {
  try {
    const p = sessionStorage.getItem('oauth_provider')
    sessionStorage.removeItem('oauth_provider')
    sessionStorage.removeItem('oauth_state')
    return p
  } catch {
    return null
  }
}

// 앱 딥링크 — provider 가 돌려준 것을 그대로 실어 보낸다(code·state 또는 error).
function buildNativeBounceUrl(params) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v)
  return `${NATIVE_REDIRECT}?${p}`
}

function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('processing')  // 'processing' | 'bounce' | 'error'
  const [errorMsg, setErrorMsg] = useState(null)
  const [bounceUrl, setBounceUrl] = useState(null)
  const handledRef = useRef(false)  // StrictMode 더블 실행 방지

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const code = searchParams.get('code')
    const state = searchParams.get('state')      // provider 가 그대로 돌려준다(토큰 교환에도 필요)
    const providerError = searchParams.get('error')
    const providerErrorDesc = searchParams.get('error_description')

    // provider 판별 — state 에 실어 보냈으므로 저장소가 끊겨도(새 탭·브라우저 전환) 알아낼 수 있다.
    //   sessionStorage 는 이전 버전으로 시작한 로그인을 위한 하위호환 폴백(배포 직후 몇 분간만 의미).
    const parsed = parseOAuthState(state)
    const provider = parsed?.provider || readAndClearLegacyProvider()

    // ─── 네이티브 앱에서 시작한 로그인 → 앱으로 튕긴다(검증·교환 없이) ───
    if (parsed?.native) {
      const url = buildNativeBounceUrl({
        provider, code, state,
        error: providerError, error_description: providerErrorDesc,
      })
      setBounceUrl(url)
      setStatus('bounce')
      // Custom Tab 에서 커스텀 스킴으로 이동하면 앱이 열리고 탭은 앱이 닫는다. 안 열리면 아래 버튼.
      window.location.replace(url)
      return
    }

    // provider 가 에러 응답 (사용자가 동의 취소 등)
    if (providerError) {
      setStatus('error')
      setErrorMsg(`${PROVIDER_LABEL[provider] ?? '소셜'} 로그인이 취소됐어요`)
      return
    }
    if (!provider || !code) {
      setStatus('error')
      setErrorMsg('로그인 정보가 없어요. 로그인 화면에서 다시 시도해주세요.')
      return
    }

    // CSRF — 카카오·네이버 모두 검증(예전엔 네이버만 했다).
    //   검증 실패를 두 가지로 나눠 안내가 달라지게 한다:
    //     mismatch    = 우리가 보낸 값과 다름 → 의심스러운 요청
    //     unavailable = 저장한 값 자체가 없음 → 만료됐거나 로그인을 시작한 브라우저가 아님
    if (parsed) {
      const nonceCheck = verifyOAuthNonce(parsed.nonce)
      if (nonceCheck === 'mismatch') {
        setStatus('error')
        setErrorMsg('보안 검증에 실패했어요 (state 불일치) — 다시 시도해주세요')
        return
      }
      if (nonceCheck === 'unavailable') {
        setStatus('error')
        setErrorMsg('로그인을 시작한 브라우저와 다른 곳에서 열렸어요. 처음 눌렀던 브라우저(또는 앱)에서 다시 로그인해주세요.')
        return
      }
    }
    if (!PROVIDER_FN[provider]) {
      setStatus('error')
      setErrorMsg(`아직 지원하지 않는 provider: ${provider}`)
      return
    }

    // 현재 페이지의 redirect_uri 를 Edge Function 에도 전달 (token 교환 시 동일해야 함)
    const redirectUri = `${window.location.origin}/auth/callback`
    completeProviderLogin({ provider, code, state, redirectUri })
      .then(() => {
        // 로그인 완료 → 홈으로. HomePage 가 nickname 체크 후 적절한 페이지로 이동
        navigate('/', { replace: true })
      })
      .catch((err) => {
        console.error('OAuth callback 실패:', err)
        setStatus('error')
        setErrorMsg(err?.message || '로그인 처리 중 오류가 발생했어요')
      })
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen bg-surface-app flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-card-lg shadow-soft border border-gray-100 p-8 text-center">
        {status === 'processing' && (
          <>
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mx-auto mb-4" />
            <h1 className="text-lg font-bold text-gray-800 mb-1">로그인 처리 중...</h1>
            <p className="text-sm text-gray-500">잠시만 기다려주세요</p>
          </>
        )}
        {status === 'bounce' && (
          <>
            <Smartphone className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-lg font-bold text-gray-800 mb-1">앱으로 돌아가는 중...</h1>
            <p className="text-sm text-gray-500 mb-5 break-keep">자동으로 돌아가지 않으면 아래를 눌러주세요.</p>
            <a
              href={bounceUrl}
              className="inline-block px-5 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-sm font-semibold rounded-pill shadow-soft transition"
            >
              도담 앱 열기
            </a>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h1 className="text-lg font-bold text-gray-800 mb-2">로그인 실패</h1>
            <p className="text-sm text-gray-500 mb-5 break-words">{errorMsg}</p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm font-semibold rounded-pill shadow-soft transition"
            >
              로그인 페이지로
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default AuthCallbackPage
