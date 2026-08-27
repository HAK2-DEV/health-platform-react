import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { parseOAuthState, verifyOAuthNonce } from '../lib/oauthState'

// Day 65 — 소셜 OAuth callback 처리 페이지.
// Kakao/Naver 등 커스텀 OAuth 흐름에서 provider 가 이 경로로 code 를 돌려줌.
// 라우트: /auth/callback?provider=kakao&code=...
//
// 흐름:
//   1) URL 에서 provider + code 읽기
//   2) 해당 Edge Function 호출 → { email, token_hash, verification_type } 받기
//   3) supabase.auth.verifyOtp 로 세션 생성 (로그인 완료)
//   4) HomePage 진입 → nickname 체크 → /nickname-setup 자동 이동 (기존 흐름)
//
// Google 은 Supabase 기본 OAuth 라 자동 처리 — 이 페이지 거치지 않음.

const PROVIDER_FN = {
  kakao: 'kakao-oauth',
  naver: 'naver-oauth',
}

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

function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('processing')  // 'processing' | 'error'
  const [errorMsg, setErrorMsg] = useState(null)
  const handledRef = useRef(false)  // StrictMode 더블 실행 방지

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const code = searchParams.get('code')
    const state = searchParams.get('state')      // provider 가 그대로 돌려준다(토큰 교환에도 필요)
    const providerError = searchParams.get('error')

    // provider 판별 — state 에 실어 보냈으므로 저장소가 끊겨도(새 탭·브라우저 전환) 알아낼 수 있다.
    //   sessionStorage 는 이전 버전으로 시작한 로그인을 위한 하위호환 폴백(배포 직후 몇 분간만 의미).
    const parsed = parseOAuthState(state)
    const provider = parsed?.provider || readAndClearLegacyProvider()

    // provider 가 에러 응답 (사용자가 동의 취소 등)
    if (providerError) {
      setStatus('error')
      setErrorMsg(`${provider ?? '소셜'} 로그인이 취소됐어요`)
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
    const fnName = PROVIDER_FN[provider]
    if (!fnName) {
      setStatus('error')
      setErrorMsg(`아직 지원하지 않는 provider: ${provider}`)
      return
    }

    handleCallback(fnName, code, state)
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

  async function handleCallback(fnName, code, state) {
    // 현재 페이지의 redirect_uri 를 Edge Function 에도 전달 (token 교환 시 동일해야 함)
    const redirectUri = `${window.location.origin}/auth/callback`

    // state 는 Naver 토큰 교환에 필요 (Kakao 함수는 무시) → 항상 동봉
    const { data, error } = await supabase.functions.invoke(fnName, {
      body: { code, redirect_uri: redirectUri, state },
    })
    if (error) {
      // FunctionsHttpError 의 경우 context.json() 로 본문 추출
      let detail = error.message
      if (error?.context && typeof error.context.json === 'function') {
        try {
          const body = await error.context.json()
          if (body?.error) detail = body.error
        } catch { /* json 파싱 실패 시 기본 메시지 유지 */ }
      } else if (data?.error) {
        detail = data.error
      }
      throw new Error(detail)
    }
    if (!data?.email || !data?.token_hash) {
      throw new Error('서버 응답에 필수 필드가 없어요')
    }

    // verifyOtp 로 세션 생성 → 자동 로그인.
    // token_hash 사용 시 email 동봉 금지 ("Only the token_hash and type should be provided").
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: data.token_hash,
      type: data.verification_type ?? 'magiclink',
    })
    if (verifyErr) throw verifyErr
  }

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
