import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Hourglass } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

function HomePage() {
  const { session, isLoading } = useAuth()
  const navigate = useNavigate()
  const [isChecking, setIsChecking] = useState(true)
  const ranRef = useRef(false)  // StrictMode 이중 실행 가드 — 소비/네비 1회만

  useEffect(() => {
    if (isLoading) return

    if (!session) {
      navigate('/login')
      return
    }

    if (ranRef.current) return
    ranRef.current = true

    const checkNickname = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('nickname')
        .eq('id', session.user.id)
        .maybeSingle()

      if (error) {
        console.error('닉네임 체크 실패:', error)
        ranRef.current = false  // 재시도 허용
        return
      }

      if (!data?.nickname) {
        // 닉네임 설정 후 다시 '/' 로 와서 (새 mount) 복귀 경로를 소비
        navigate('/nickname-setup')
        return
      }

      // 초대링크 등으로 진입했다 로그인한 경우 저장된 경로로 복귀 (1회 소비) — 온보딩보다 우선
      const redirect = sessionStorage.getItem('post_auth_redirect')
      if (redirect) {
        sessionStorage.removeItem('post_auth_redirect')
        navigate(redirect, { replace: true })
        setIsChecking(false)
        return
      }

      // 조건 3 — 온보딩(설명하기) 미완주자에게 접속 시 노출. (기존 가입 회원 포함)
      // 마킹은 온보딩을 끝까지 봤을 때(마지막 화면 도달)만 됨 → 중간에 나가면 다음 접속에 다시 노출.
      try {
        if (!localStorage.getItem('onboarding-done')) {
          navigate('/onboarding', { replace: true })
          return
        }
      } catch { /* localStorage 불가 환경 무시 */ }

      navigate('/dashboard', { replace: true })
      setIsChecking(false)
    }

    checkNickname()
  }, [session, isLoading, navigate])

  if (isLoading || isChecking) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed inset-0 flex flex-col items-center justify-center gap-3 text-gray-500"
      >
        {/* 모래시계 — 멈췄다 뒤집히기를 반복(실제 모래시계 플립 느낌) */}
        <motion.div
          animate={{ rotate: [0, 0, 180, 180, 360] }}
          transition={{ duration: 1.6, times: [0, 0.35, 0.5, 0.85, 1], repeat: Infinity, ease: 'easeInOut' }}
        >
          <Hourglass className="w-11 h-11 text-emerald-500" strokeWidth={1.7} />
        </motion.div>
        <p className="text-[15px] font-medium">로딩 중...</p>
      </motion.div>
    )
  }

  return null
}

export default HomePage
