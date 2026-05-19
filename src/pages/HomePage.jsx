import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

function HomePage() {
  const { session, isLoading } = useAuth()
  const navigate = useNavigate()
  const [isChecking, setIsChecking] = useState(true)
  
  useEffect(() => {
    if (isLoading) return
    
    // 로그인 안 됨
    if (!session) {
      navigate('/login')
      return
    }
    
    // 로그인 됨 → 닉네임 체크
    const checkNickname = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('nickname')
        .eq('id', session.user.id)
        .single()
      
      if (error) {
        console.error('닉네임 체크 실패:', error)
        return
      }
      
      if (!data?.nickname) {
        // 닉네임 없음 → 설정 페이지
        navigate('/nickname-setup')
      } else {
        // 닉네임 있음 → 메인
        navigate('/todos')
      }
      
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