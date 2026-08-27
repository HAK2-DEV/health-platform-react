import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { UserPlus, Activity, Check } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import SocialAuthButtons from '../components/auth/SocialAuthButtons'
import Modal from '../components/common/Modal'
import { TermsContent, PrivacyContent } from '../components/legal/LegalContent'

// Day 65 — 약관 동의 흐름 추가:
//   [필수] 만 14세 이상
//   [필수] 이용약관 동의
//   [필수] 개인정보 수집·이용 동의
//   [선택] 마케팅 정보 수신 동의 (미구현 — 추후 알림 설정과 연계)
// 모든 필수 항목 체크해야 회원가입 버튼 활성.
// 소셜 로그인 사용자도 같은 동의 화면 거치도록 추후 /nickname-setup 에서 한 번 더 표시 권장.

function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [emailSent, setEmailSent] = useState(false)   // 이메일 인증 켜짐 → 확인 안내 화면
  const { session } = useAuth()

  // 동의 체크박스 상태
  const [agreeAge, setAgreeAge] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeMarketing, setAgreeMarketing] = useState(false)
  const allRequired = agreeAge && agreeTerms && agreePrivacy
  const allChecked = allRequired && agreeMarketing

  // 약관 「보기」 — 페이지 이동 대신 모달로 표시 (폼 입력값 보존 + 닫으면 제자리).
  // 'terms' | 'privacy' | null
  const [legalDoc, setLegalDoc] = useState(null)

  // "전체 동의" 토글
  const handleAgreeAll = (checked) => {
    setAgreeAge(checked)
    setAgreeTerms(checked)
    setAgreePrivacy(checked)
    setAgreeMarketing(checked)
  }

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
          data: {
            // 동의 시점·항목 추적 — user_metadata 에 저장
            agreed_terms_at: new Date().toISOString(),
            agreed_privacy_at: new Date().toISOString(),
            agreed_marketing: agreeMarketing,
          },
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
        <h2 className="text-xl font-bold text-gray-900 mb-2">이메일을 확인해주세요 📧</h2>
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
          <ConsentBox
            agreeAge={agreeAge} setAgreeAge={setAgreeAge}
            agreeTerms={agreeTerms} setAgreeTerms={setAgreeTerms}
            agreePrivacy={agreePrivacy} setAgreePrivacy={setAgreePrivacy}
            agreeMarketing={agreeMarketing} setAgreeMarketing={setAgreeMarketing}
            allChecked={allChecked}
            onAgreeAll={handleAgreeAll}
            onView={setLegalDoc}
          />

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

      {/* 약관 보기 모달 — 닫으면 회원가입 폼 그대로 복귀 (입력값·체크 유지) */}
      <Modal isOpen={legalDoc !== null} onClose={() => setLegalDoc(null)}>
        <div className="px-4 pb-6 pt-1">
          {legalDoc === 'terms' && <TermsContent />}
          {legalDoc === 'privacy' && <PrivacyContent />}
        </div>
      </Modal>
    </div>
  )
}

// ─── 약관 동의 박스 ────────────────────────────────────────
function ConsentBox({
  agreeAge, setAgreeAge,
  agreeTerms, setAgreeTerms,
  agreePrivacy, setAgreePrivacy,
  agreeMarketing, setAgreeMarketing,
  allChecked, onAgreeAll, onView,
}) {
  return (
    <div className="mt-2 border-2 border-gray-200 rounded-md p-3 space-y-2 bg-gray-50/40">
      {/* 전체 동의 */}
      <label className="flex items-center gap-2 cursor-pointer pb-2 border-b border-gray-200">
        <CheckBox checked={allChecked} onChange={(e) => onAgreeAll(e.target.checked)} />
        <span className="text-sm font-semibold text-gray-800">전체 동의</span>
      </label>

      <ConsentItem
        required
        checked={agreeAge}
        onChange={setAgreeAge}
        label="만 14세 이상입니다"
      />
      <ConsentItem
        required
        checked={agreeTerms}
        onChange={setAgreeTerms}
        label="이용약관에 동의합니다"
        onView={() => onView('terms')}
      />
      <ConsentItem
        required
        checked={agreePrivacy}
        onChange={setAgreePrivacy}
        label="개인정보 수집·이용에 동의합니다"
        onView={() => onView('privacy')}
      />
      <ConsentItem
        checked={agreeMarketing}
        onChange={setAgreeMarketing}
        label="마케팅 정보 수신에 동의합니다"
      />
    </div>
  )
}

function ConsentItem({ required, checked, onChange, label, onView }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <CheckBox checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-xs text-gray-700 flex-1">
        <span className={required ? 'text-emerald-600 font-semibold' : 'text-gray-500'}>
          [{required ? '필수' : '선택'}]
        </span>{' '}
        {label}
      </span>
      {onView && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onView() }}
          className="text-xs text-emerald-600 underline flex-shrink-0"
        >
          보기
        </button>
      )}
    </label>
  )
}

function CheckBox({ checked, onChange }) {
  return (
    <span className="relative w-5 h-5 flex-shrink-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        className={`
          absolute inset-0 rounded-md border-2 flex items-center justify-center transition
          ${checked
            ? 'bg-brand-primary border-brand-primary'
            : 'bg-white border-gray-300 hover:border-emerald-400'}
        `}
      >
        {checked && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      </span>
    </span>
  )
}

export default SignupPage
