import { useEffect, useState, useRef } from 'react'
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

      // 초대링크 등으로 진입했다 로그인한 경우 저장된 경로로 복귀 (1회 소비)
      const redirect = sessionStorage.getItem('post_auth_redirect')
      sessionStorage.removeItem('post_auth_redirect')
      navigate(redirect || '/dashboard', { replace: true })
      setIsChecking(false)
    }

    checkNickname()
  }, [session, isLoading, navigate])

  if (isLoading || isChecking) {
    return <p>⏳ 로딩 중...</p>
  }

  return null
}

export default HomePage
