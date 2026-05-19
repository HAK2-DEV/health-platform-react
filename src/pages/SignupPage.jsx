import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { UserPlus, Activity } from 'lucide-react'

function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) throw signUpError

      // 회원가입 성공 → 닉네임 설정 페이지로
      navigate('/nickname-setup')
    } catch (err) {
      console.error('회원가입 실패:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
      <h1 className="flex items-center gap-2 text-2xl md:text-3xl text-green-500 mb-2">
        <Activity className="w-8 h-8" />
        건강증진 플랫폼
      </h1>
      <p className="text-gray-600 text-base mb-6">
        함께 건강한 습관을 만들어요
      </p>

      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md mx-auto">
        <div className="flex items-center justify-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-green-500" />
          <h2 className="text-xl text-green-500">회원가입</h2>
        </div>

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
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-base font-medium rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {isLoading ? '처리 중...' : '회원가입'}
          </button>
        </form>

        {error && (
          <p className="mt-4 p-2 text-center bg-red-100 text-red-700 rounded text-sm">
            {error}
          </p>
        )}

        <p className="mt-4 text-center text-gray-600 text-sm">
          이미 계정이 있나요?
          <Link to="/login" className="ml-2 text-green-500 underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}

export default SignupPage