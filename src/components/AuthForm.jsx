import { useState } from "react"
import { supabase } from "../supabaseClient"
import { KeyRound, UserPlus } from 'lucide-react'

function AuthForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage("")

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) setMessage("❌ 회원가입 실패: " + error.message)
        else setMessage("✅ 회원가입 성공! 이메일 확인 후 로그인하세요.")
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setMessage("❌ 로그인 실패: " + error.message)
        else setMessage("✅ 로그인 성공!")
      }
    } catch (err) {
      setMessage("❌ 에러: " + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md mx-auto">
      <h2 className="flex items-center justify-center gap-2 text-xl text-green-500 mb-4">
  {isSignUp ? (
    <>
      <UserPlus className="w-5 h-5" />
      회원가입
    </>
  ) : (
    <>
      <KeyRound className="w-5 h-5" />
      로그인
    </>
  )}
</h2>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input 
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          required
          className="px-3 py-2 text-base border-2 border-gray-200 rounded-md focus:outline-none focus:border-green-500"
        />
        
        <input 
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (6자 이상)"
          required
          minLength={6}
          className="px-3 py-2 text-base border-2 border-gray-200 rounded-md focus:outline-none focus:border-green-500"
        />
        
        <button 
          type="submit" 
          disabled={isLoading}
          className="px-4 py-2 bg-green-500 text-white text-base font-medium rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          {isLoading ? "처리 중..." : (isSignUp ? "회원가입" : "로그인")}
        </button>
      </form>

      <p className="mt-4 text-center text-gray-600">
        {isSignUp ? "이미 계정이 있나요?" : "계정이 없나요?"}
        <button 
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp)
            setMessage("")
          }}
          className="ml-2 text-green-500 underline"
        >
          {isSignUp ? "로그인" : "회원가입"}
        </button>
      </p>
      
      {message && (
        <p className="mt-4 p-2 text-center bg-gray-100 rounded text-sm">
          {message}
        </p>
      )}
    </div>
  )
}

export default AuthForm