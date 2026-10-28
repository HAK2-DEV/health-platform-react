import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { WEB_ORIGIN } from '../lib/socialAuthUrls'
import { takeAuthUrlError } from '../lib/authUrlError'
import { isPasswordRecovery, clearPasswordRecovery } from '../lib/passwordRecovery'
import StickyBackBar from '../components/common/StickyBackBar'
import LoadingState from '../components/common/LoadingState'

// 비밀번호 찾기 (2026-10-28, BUG_LOG 25) — 로그인 화면에 되찾을 길이 없었다.
//   ① 요청: 가입 이메일 → 재설정 메일(Supabase resetPasswordForEmail). 소셜 가입자는 비밀번호가 없다는 안내를 같이.
//   ② 설정: 메일 링크로 들어오면(부팅 때 lib/passwordRecovery 가 표시) 새 비밀번호 저장.
//   링크는 앱(네이티브)에서 요청해도 폰 브라우저에서 열리므로 복귀 주소는 늘 웹(WEB_ORIGIN).
const CONTACT_EMAIL = '00jonghak@gmail.com'   // SupportPage 와 같은 문의 주소

const inputCls = 'w-full min-w-0 px-3 py-2 text-base border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500'
const primaryCls = 'w-full px-4 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-base font-medium rounded-md disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition'

function ResetPasswordPage() {
  const { session, isLoading } = useAuth()
  // 들어올 때 한 번만 읽는다 — 저장 성공 때 표시를 지우면(세션 갱신으로 다시 그려질 때) 완료 화면이 요청 화면으로 바뀌던 것 방지
  const [recovering] = useState(() => isPasswordRecovery())

  if (recovering && isLoading) return <LoadingState variant="page" />

  return (
    <div className="px-4 pt-2 pb-10 max-w-md mx-auto">
      <StickyBackBar fallbackPath="/login" title="로그인으로" />
      {recovering && session ? <SetNewPassword email={session.user?.email} /> : <RequestReset />}
    </div>
  )
}

// ① 재설정 메일 요청
function RequestReset() {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState(null)
  const [error, setError] = useState(null)
  const [isSending, setIsSending] = useState(false)
  // 만료·이미 쓴 링크로 돌아온 경우 — 이 화면에서 바로 다시 받게
  const [linkError] = useState(() => takeAuthUrlError())

  const handleSubmit = async (e) => {
    e.preventDefault()
    const em = email.trim()
    setError(null)
    // 카카오·네이버 가상 이메일(…@kakao.local 등)은 메일이 갈 곳이 없다 — 보내면 반송만 쌓인다
    if (/\.local$/i.test(em)) { setError('카카오·네이버로 가입한 계정이에요. 로그인 화면의 카카오·네이버 버튼으로 로그인해 주세요.'); return }
    setIsSending(true)
    // 복귀 주소는 /auth/ 아래 — 이번 배포 «전» 서비스워커도 /auth/ 는 가로채지 않는다(vite.config denylist).
    //   /reset-password 로 받으면 옛 워커가 옛 index.html(이 화면 없음)을 내줘 빈 화면 + 토큰만 소비된다(배포 전 실메일로 확인).
    const { error: err } = await supabase.auth.resetPasswordForEmail(em, { redirectTo: `${WEB_ORIGIN}/auth/reset-password` })
    setIsSending(false)
    if (err) {
      setError(/rate limit|security purposes/i.test(err.message)
        ? '방금 메일을 보냈어요. 1분쯤 뒤에 다시 시도해 주세요.'
        : `메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요. [${err.message}]`)
      return
    }
    setSentTo(em)
  }

  return (
    <div className="mt-2">
      <h1 className="text-2xl font-bold text-gray-900">비밀번호 다시 만들기</h1>
      <p className="mt-1.5 text-sm text-gray-600 break-keep">가입한 이메일을 적으면 새 비밀번호를 만드는 링크를 보내드려요.</p>

      <div className="mt-5 bg-white p-6 rounded-lg shadow-md">
        {linkError && !sentTo && (
          <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-amber-900 leading-relaxed break-keep">링크가 만료됐거나 이미 사용됐어요. 아래에서 메일을 다시 받아주세요.</p>
          </div>
        )}

        {sentTo ? (
          <div className="flex gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">메일을 보냈어요</p>
              <p className="mt-1 text-sm text-gray-600 leading-relaxed break-keep">
                <span className="font-semibold text-gray-800 break-words">{sentTo}</span> 메일함(스팸함 포함)에서 「비밀번호 재설정」 메일의 링크를 눌러주세요.
              </p>
              <p className="mt-2 text-[13px] text-gray-500 leading-relaxed break-keep">
                메일이 오지 않으면 주소를 다시 확인해 주세요. 가입하지 않은 주소로는 메일이 가지 않아요.
              </p>
              <button type="button" onClick={() => setSentTo(null)} className="mt-3 text-sm font-semibold text-emerald-600 hover:text-emerald-700">
                다른 주소로 다시 받기
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-[9px]">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="가입한 이메일"
              required
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={inputCls}
            />
            {error && <p className="text-[13px] text-amber-700 break-keep">{error}</p>}
            <button type="submit" disabled={isSending || !email.trim()} className={primaryCls}>
              <span className="inline-flex items-center justify-center gap-1.5"><Mail className="w-4 h-4" />{isSending ? '보내는 중...' : '재설정 링크 받기'}</span>
            </button>
          </form>
        )}
      </div>

      {/* 비밀번호가 없는 경우·이메일을 모르는 경우 — 메일을 보내기 전에 알아야 할 것 */}
      <div className="mt-6 space-y-4 px-1">
        <div>
          <p className="text-sm font-semibold text-gray-800">카카오·네이버·구글로 가입했나요?</p>
          <p className="mt-1 text-[13px] text-gray-600 leading-relaxed break-keep">
            소셜로 가입한 계정은 비밀번호가 없어요. 로그인 화면에서 처음 가입할 때 누른 버튼을 그대로 눌러주세요.
          </p>
          <Link to="/login" className="mt-1.5 inline-block text-sm font-semibold text-emerald-600 hover:text-emerald-700">로그인 화면으로</Link>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">가입한 이메일이 기억나지 않나요?</p>
          <p className="mt-1 text-[13px] text-gray-600 leading-relaxed break-keep">
            닉네임과 가입한 무렵을 적어 문의해 주시면 확인해 드릴게요.
          </p>
          <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('[도담] 가입 이메일 확인 요청')}`}
            className="mt-1.5 inline-block text-sm font-semibold text-emerald-600 hover:text-emerald-700">{CONTACT_EMAIL}</a>
        </div>
      </div>
    </div>
  )
}

// ② 새 비밀번호 저장 — 재설정 링크로 들어와 로그인된 상태
function SetNewPassword({ email }) {
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (pw.length < 6) { setError('비밀번호는 6자 이상이어야 해요'); return }
    if (pw !== pw2) { setError('두 비밀번호가 서로 달라요'); return }
    setIsSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password: pw })
    setIsSaving(false)
    if (err) {
      setError(/different from the old/i.test(err.message)
        ? '지금 쓰던 비밀번호와 달라야 해요'
        : `저장하지 못했어요. 잠시 후 다시 시도해 주세요. [${err.message}]`)
      return
    }
    clearPasswordRecovery()
    setDone(true)
  }

  if (done) {
    return (
      <div className="mt-2">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">새 비밀번호로 바꿨어요</p>
              <p className="mt-1 text-sm text-gray-600 leading-relaxed break-keep">
                앱에서 로그인하던 중이었다면 앱으로 돌아가 <span className="font-semibold text-gray-800 break-words">{email}</span> 와 새 비밀번호로 로그인해 주세요.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => navigate('/dashboard', { replace: true })} className={`${primaryCls} mt-5`}>
            여기서 도담 시작하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2">
      <h1 className="text-2xl font-bold text-gray-900">새 비밀번호 만들기</h1>
      <p className="mt-1.5 text-sm text-gray-600 break-keep">
        <span className="font-semibold text-gray-800 break-words">{email}</span> 계정에서 쓸 새 비밀번호를 적어주세요.
      </p>
      <form onSubmit={handleSubmit} className="mt-5 bg-white p-6 rounded-lg shadow-md flex flex-col gap-[9px]">
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="새 비밀번호 (6자 이상)"
          required minLength={6} autoComplete="new-password" className={inputCls} />
        <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="새 비밀번호 확인"
          required minLength={6} autoComplete="new-password" className={inputCls} />
        {error && <p className="text-[13px] text-amber-700 break-keep">{error}</p>}
        <button type="submit" disabled={isSaving} className={primaryCls}>
          <span className="inline-flex items-center justify-center gap-1.5"><KeyRound className="w-4 h-4" />{isSaving ? '저장 중...' : '새 비밀번호 저장'}</span>
        </button>
      </form>
    </div>
  )
}

export default ResetPasswordPage
