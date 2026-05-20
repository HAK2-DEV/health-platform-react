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
    
    if (!session) {
      navigate('/login')
      return
    }
    
    const checkNickname = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('nickname')
        .eq('id', session.user.id)
        .maybeSingle()
      
      if (error) {
        console.error('닉네임 체크 실패:', error)
        return
      }
      
      if (!data?.nickname) {
        navigate('/nickname-setup')
      } else {
        navigate('/dashboard')
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