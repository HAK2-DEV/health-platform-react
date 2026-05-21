import { supabase } from '../supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { LogOut } from 'lucide-react'

// 프로필 페이지 — Bottom Tab Bar 의 👤 프로필 탭 진입점
// 현재: 닉네임 / 이메일 표시 + 로그아웃
// 미래: 닉네임 변경 (7일 제한, NicknameInput 재사용) + 프로필 사진 + 통계
function ProfilePage() {
  const { session, nickname } = useAuth()

  const handleLogout = () => {
    supabase.auth.signOut()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl text-gray-800 mb-4">👤 프로필</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
        <p className="text-xs text-gray-500 mb-1">닉네임</p>
        <p className="text-lg font-medium text-gray-800">{nickname || '-'}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <p className="text-xs text-gray-500 mb-1">이메일</p>
        <p className="text-gray-800">{session?.user?.email}</p>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition"
      >
        <LogOut className="w-4 h-4" />
        로그아웃
      </button>

      <p className="text-center text-xs text-gray-400 mt-6">
        닉네임 변경 · 프로필 사진 · 통계 (준비 중)
      </p>
    </div>
  )
}

export default ProfilePage
