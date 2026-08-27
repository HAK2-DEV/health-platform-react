// src/components/AuthForm.jsx
import { useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "../supabaseClient"
import { KeyRound, AlertCircle, Mail } from 'lucide-react'
import SocialAuthButtons from "./auth/SocialAuthButtons"
import { takeAuthUrlError } from "../lib/authUrlError"

// 인증 링크 실패 정보는 모듈 로드 시 1회 소비한다.
//   (effect 안에서 setState 하면 렌더 타이밍 문제 — react-hooks/set-state-in-effect)
//   이 모듈은 로그인 화면에 진입할 때 로드되고, 링크로 되돌아온 경우 페이지가 통째로
//   새로 뜨므로 "실패하고 돌아온 그 순간" 에만 값이 잡힌다.
const INITIAL_NOTICE = takeAuthUrlError()

// 로그인 실패 원문(영문)을 그대로 보여주던 자리 — 자주 나오는 것만 한글로.
function loginErrorMessage(raw) {
  if (/invalid login credentials/i.test(raw)) return "이메일 또는 비밀번호가 올바르지 않아요"
  if (/email not confirmed/i.test(raw)) return "아직 이메일 인증이 끝나지 않았어요"
  return raw
}

function AuthForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  // 인증 링크 실패 안내 — { message, canResend }.
  //   링크가 만료·재사용돼 되돌아온 사실을 여기서 처음으로 사용자에게 알린다.
  //   (그전까지는 아무 설명 없이 로그인 화면만 떠서 원인을 알 수 없었다)
  const [notice, setNotice] = useState(INITIAL_NOTICE)
  const [isResending, setIsResending] = useState(false)

  // 인증 메일 다시 보내기 — 만료·미인증 양쪽의 실질적인 출구.
  const handleResend = async () => {
    const em = email.trim()
    if (!em) {
      setNotice({ message: "메일을 다시 받을 이메일 주소를 위에 입력해주세요", canResend: true })
      return
    }
    setIsResending(true)
    setMessage("")
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: em,
      options: { emailRedirectTo: window.location.origin },
    })
    setIsResending(false)
    if (error) {
      setMessage("❌ 메일 재발송 실패: " + error.message)
    } else {
      setNotice(null)
      setMessage("✅ 인증 메일을 다시 보냈어요. 메일함(스팸함 포함)을 확인해주세요.")
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage("")

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        // 미인증 계정은 단순 실패가 아니라 "메일 링크를 눌러야 한다" 는 안내가 필요하다.
        if (/email not confirmed/i.test(error.message)) {
          setNotice({
            message: "아직 이메일 인증이 끝나지 않았어요. 받은 메일의 링크를 눌러주세요.",
            canResend: true,
          })
        } else {
          setMessage("❌ 로그인 실패: " + loginErrorMessage(error.message))
        }
      } else {
        setMessage("✅ 로그인 성공!")
      }
    } catch (err) {
      setMessage("❌ 에러: " + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md mx-auto">
      <h2 className="flex items-center justify-center gap-2 text-xl text-emerald-500 mb-4">
        <KeyRound className="w-5 h-5" />
        로그인
      </h2>

      {/* 인증 링크 실패·미인증 안내 — 원인과 출구(재발송)를 함께 준다 */}
      {notice && (
        <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-amber-900 leading-relaxed break-keep">{notice.message}</p>
          </div>
          {notice.canResend && (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white border border-amber-300 text-[13px] font-semibold text-amber-900 disabled:opacity-50 transition"
            >
              <Mail className="w-3.5 h-3.5" />
              {isResending ? '보내는 중...' : '인증 메일 다시 보내기'}
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-[9px]">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          required
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
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
        <button 
          type="submit" 
          disabled={isLoading}
          className="px-4 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-base font-medium rounded-md disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition"
        >
          {isLoading ? "처리 중..." : "로그인"}
        </button>
      </form>

      <p className="text-center text-gray-600 text-sm" style={{ marginTop: '11px' }}>
        계정이 없나요?
        <Link to="/signup" className="ml-2 text-emerald-500 underline">
          회원가입
        </Link>
      </p>

      {message && (
        <p className="mt-4 p-2 text-center bg-gray-100 rounded text-sm">
          {message}
        </p>
      )}

      {/* 소셜 로그인 — Day 65 본인 결정 */}
      <SocialAuthButtons />
    </div>
  )
}

export default AuthForm