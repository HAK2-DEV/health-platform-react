import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../supabaseClient'

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
  // naver: 'naver-oauth',  // 추후 추가
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

    const provider = searchParams.get('provider')
    const code = searchParams.get('code')
    const providerError = searchParams.get('error')

    // provider 가 에러 응답 (사용자가 동의 취소 등)
    if (providerError) {
      setStatus('error')
      setErrorMsg(`${provider ?? '소셜'} 로그인이 취소됐어요`)
      return
    }
    if (!provider || !code) {
      setStatus('error')
      setErrorMsg('잘못된 접근이에요 (provider/code 누락)')
      return
    }
    const fnName = PROVIDER_FN[provider]
    if (!fnName) {
      setStatus('error')
      setErrorMsg(`아직 지원하지 않는 provider: ${provider}`)
      return
    }

    handleCallback(fnName, code)
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

  async function handleCallback(fnName, code) {
    // 현재 페이지의 redirect_uri 를 Edge Function 에도 전달 (token 교환 시 동일해야 함)
    const redirectUri = `${window.location.origin}/auth/callback`

    const { data, error } = await supabase.functions.invoke(fnName, {
      body: { code, redirect_uri: redirectUri },
    })
    if (error) {
      // functions.invoke 는 4xx/5xx 응답도 error 로 던짐
      const detail = data?.error ?? error.message
      throw new Error(detail || 'Edge Function 호출 실패')
    }
    if (!data?.email || !data?.token_hash) {
      throw new Error('서버 응답에 필수 필드가 없어요')
    }

    // verifyOtp 로 세션 생성 → 자동 로그인
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email: data.email,
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
