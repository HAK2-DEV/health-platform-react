import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { UserPlus, Activity, Check } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import SocialAuthButtons from '../components/auth/SocialAuthButtons'
import ConsentBox from '../components/legal/ConsentBox'
import { EMPTY_CONSENT, isAllRequiredAgreed, consentMetadata } from '../lib/consent'

// Day 65 — 약관 동의 흐름 추가:
//   [필수] 만 14세 이상
//   [필수] 이용약관 동의
//   [필수] 개인정보 수집·이용 동의
//   [선택] 마케팅 정보 수신 동의 (미구현 — 추후 알림 설정과 연계)
// 모든 필수 항목 체크해야 회원가입 버튼 활성.
// 2026-08-27: 동의 UI 를 components/legal/ConsentBox 로 추출 — 소셜 가입자는 이 폼을 안 거치므로
//   /nickname-setup 에서 같은 박스를 띄워 동의를 받는다(그동안 소셜 경로엔 동의 절차가 없었음).

function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [emailSent, setEmailSent] = useState(false)   // 이메일 인증 켜짐 → 확인 안내 화면
  const { session } = useAuth()

  // 동의 상태 — UI 는 ConsentBox, 판정·metadata 생성은 lib/consent (소셜 경로와 공용).
  const [consent, setConsent] = useState(EMPTY_CONSENT)
  const allRequired = isAllRequiredAgreed(consent)

  useEffect(() => {
    if (session) navigate('/')
  }, [session, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!allRequired) {
      setError('필수 약관 동의가 필요해요')
      return
    }
    const em = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setError('올바른 이메일 주소를 입력해주세요 (예: name@example.com)')
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요')
      return
    }
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: em,
        password,
        options: {
          emailRedirectTo: window.location.origin,   // 인증 메일 링크가 앱으로 복귀(대시보드 Redirect URLs 에 등록 필요)
          // 동의 시점·항목 추적 — user_metadata 에 저장.
          //   agreed_terms_at 유무로 "이미 동의한 사용자" 를 판별한다(소셜 경로가 이 값을 봄).
          data: consentMetadata(consent),
        },
      })

      if (signUpError) throw signUpError
      // 이메일 인증 ON → 세션 없음(확인 대기): 안내 화면. OFF → 세션 있음: 바로 닉네임 설정.
      if (data?.session) navigate('/nickname-setup')
      else setEmailSent(true)
    } catch (err) {
      console.error('회원가입 실패:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 이메일 인증 대기 화면
  if (emailSent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-emerald-500" strokeWidth={2.5} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">이메일을 확인해주세요 </h2>
        <p className="text-[14px] text-gray-600 leading-relaxed break-keep max-w-xs">
          <b className="text-emerald-600">{email}</b> 으로<br />인증 메일을 보냈어요.
          메일의 <b>링크를 눌러</b> 가입을 완료해주세요.
        </p>
        <p className="text-[12px] text-gray-400 mt-4 break-keep max-w-xs leading-relaxed">
          메일이 안 보이면 <b>스팸함</b>도 확인해주세요.<br />링크를 누르면 자동으로 로그인돼요.
        </p>
        <Link to="/login" className="mt-6 text-[13px] font-bold text-emerald-600">로그인 화면으로</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
      <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-medium text-emerald-500 mb-2">
        <Activity className="w-8 h-8" />
        건강증진 플랫폼
      </h1>
      <p className="text-gray-600 text-base mb-6">
        함께 건강한 습관을 만들어요
      </p>

      <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-md w-full max-w-md mx-auto">
        <div className="flex items-center justify-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-emerald-500" />
          <h2 className="text-xl font-semibold text-emerald-500">회원가입</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            required
            className="px-3 py-2 text-base border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 (6자 이상)"
            required
            minLength={6}
            className="px-3 py-2 text-base border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500"
          />

          {/* 약관 동의 박스 */}
          <ConsentBox value={consent} onChange={setConsent} />

          <button
            type="submit"
            disabled={isLoading || !allRequired}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-base font-medium rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {isLoading ? '처리 중...' : '회원가입'}
          </button>
        </form>

        {error && (
          <p className="mt-4 p-2 text-center bg-red-100 text-red-700 rounded-xl text-sm">
            {error}
          </p>
        )}

        <p className="mt-4 text-center text-gray-600 text-sm">
          이미 계정이 있나요?
          <Link to="/login" className="ml-2 text-emerald-500 underline">
            로그인
          </Link>
        </p>

        {/* 소셜 회원가입 — Day 65 본인 결정 */}
        <SocialAuthButtons />
      </div>
    </div>
  )
}

export default SignupPage
