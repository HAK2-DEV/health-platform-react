import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useNicknameCheck } from '../hooks/useNicknameCheck'
import { UserPlus } from 'lucide-react'
import NicknameInput from '../components/auth/NicknameInput'
import { takePendingInvite } from '../lib/pendingInvite'

function NicknameSetupPage() {
  const { session, refreshNickname } = useAuth()
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState(null)      // 'M' | 'F' | null(비공개) — 선택
  const [ageRange, setAgeRange] = useState(null)  // '10s'~'70s' | null — 선택
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
      .update({ nickname, gender, age_range: ageRange })
      .eq('id', session.user.id)
    
    if (updateError) throw updateError
    
    await refreshNickname()
    // 초대링크로 들어온 신규 유저면 온보딩보다 초대 참여를 우선(없으면 온보딩 튜토리얼).
    //   NicknameSetupPage 는 '/' 를 안 거치고 직행하므로 여기서 초대 복귀를 직접 처리.
    const invite = takePendingInvite()
    navigate(invite || '/onboarding')
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
      <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-md w-full max-w-md mx-auto">
        <div className="flex items-center justify-center gap-2 mb-4">
          <UserPlus className="w-6 h-6 text-emerald-500" />
          <h2 className="text-xl font-semibold text-emerald-500">닉네임 설정</h2>
        </div>
        
        <p className="text-sm text-gray-600 text-center mb-6">
          서비스에서 사용할 닉네임을 설정해주세요.
          <br />
          한 번 설정하면 7일 후 변경 가능합니다.
        </p>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <NicknameInput value={nickname} onChange={setNickname} />

          {/* 선택 — 건강 통계·형평성 분석에만 사용 */}
          <div>
            <p className="text-xs text-gray-500 mb-2">아래는 <b>선택 사항</b>이에요 · 건강 통계·형평성 분석에만 쓰여요</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[12px] font-medium text-gray-500">성별</span>
                <div className="flex gap-1.5 mt-1">
                  {[['M', '남'], ['F', '여']].map(([v, l]) => (
                    <button type="button" key={v} onClick={() => setGender(gender === v ? null : v)}
                      className={`flex-1 h-9 rounded-lg text-[13px] font-medium border transition ${gender === v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600'}`}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[12px] font-medium text-gray-500">연령대</span>
                <select value={ageRange || ''} onChange={(e) => setAgeRange(e.target.value || null)}
                  className="mt-1 w-full h-9 rounded-lg border border-gray-200 px-2 text-[13px] text-gray-700 bg-white focus:border-emerald-400 outline-none">
                  <option value="">선택 안 함</option>
                  {[['10s', '10대'], ['20s', '20대'], ['30s', '30대'], ['40s', '40대'], ['50s', '50대'], ['60s', '60대'], ['70s', '70대+']].map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <p className="p-2 text-center bg-red-100 text-red-700 rounded-xl text-sm">
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