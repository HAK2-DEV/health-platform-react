import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useNicknameCheck } from '../hooks/useNicknameCheck'
import { UserPlus } from 'lucide-react'
import NicknameInput from '../components/auth/NicknameInput'

function NicknameSetupPage() {
  const { session, refreshNickname } = useAuth()
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  
  const status = useNicknameCheck(nickname)
  
  // 로그인 안 됨 → /login
  useEffect(() => {
    if (session === null) {
      navigate('/login')
    }
  }, [session, navigate])
  
  // 이미 닉네임 설정됨 → /
  useEffect(() => {
    const checkNickname = async () => {
      if (!session) return
      
      const { data } = await supabase
        .from('users')
        .select('nickname')
        .eq('id', session.user.id)
        .maybeSingle()                     // ⭐ .single() → .maybeSingle()
      
      if (data?.nickname) {
        navigate('/')
      }
    }
    
    checkNickname()
  }, [session, navigate])
  
const handleSubmit = async (e) => {
  e.preventDefault()
  
  if (!status.available) {
    setError('사용 가능한 닉네임을 입력해주세요')
    return
  }
  
  setIsSaving(true)
  setError(null)
  
  try {
    const { error: updateError } = await supabase
      .from('users')
      .update({ nickname })
      .eq('id', session.user.id)
    
    if (updateError) throw updateError
    
    await refreshNickname()
    navigate('/')
  } catch (err) {
    console.error('닉네임 저장 실패:', err)
    setError(err.message)
  } finally {
    setIsSaving(false)
  }
}
  
  if (!session) return null
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md mx-auto">
        <div className="flex items-center justify-center gap-2 mb-4">
          <UserPlus className="w-6 h-6 text-emerald-500" />
          <h2 className="text-xl text-emerald-500">닉네임 설정</h2>
        </div>
        
        <p className="text-sm text-gray-600 text-center mb-6">
          서비스에서 사용할 닉네임을 설정해주세요.
          <br />
          한 번 설정하면 7일 후 변경 가능합니다.
        </p>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <NicknameInput value={nickname} onChange={setNickname} />
          
          {error && (
            <p className="p-2 text-center bg-red-100 text-red-700 rounded text-sm">
              {error}
            </p>
          )}
          
          <button
            type="submit"
            disabled={!status.available || isSaving}
            className="px-4 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {isSaving ? '저장 중...' : '시작하기'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default NicknameSetupPage