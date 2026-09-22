import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AuthForm from '../components/AuthForm'

function LoginPage() {
    const {session} =useAuth()
     const navigate= useNavigate()
useEffect (()=> {
    //이미 로그인 됐으면 /todos 으로
    if (session) {
         navigate('/')
    }
}, [session, navigate])

return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">

    <div className="flex flex-col items-center gap-3">
        <img src="/app-icon.png" onError={(e) => { e.currentTarget.src = '/favicon.svg' }} alt="도담" className="w-16 h-16 rounded-2xl shadow-soft" />
        <div className="flex flex-col items-center">
          <h1 className="text-3xl font-bold text-brand-primary tracking-tight leading-none">도담</h1>
          <span className="text-xs font-semibold text-gray-500 mt-1">건강증진 플랫폼</span>
        </div>
      </div>
      <p className="text-gray-600 text-base mt-3 mb-4">
        운영은 쉽게, 건강은 단단하게
      </p>
      {/* 헤더와 로그인 카드 사이 투명 박스 — 본인 피드백: 시각적 분리 (완전 투명) */}
      <div className="w-20 h-4 mb-4" />
      <AuthForm />
      {/* 처음 온 사람이 로그인 창에서 막히지 않게 — 공개 소개 페이지로 나가는 길 */}
      <p className="mt-5 text-[13px] text-gray-500">
        도담이 처음이신가요?{' '}
        <Link to="/intro" className="font-semibold text-emerald-600 hover:text-emerald-700">
          어떤 앱인지 보기
        </Link>
      </p>
    </div>
  )
}

export default LoginPage