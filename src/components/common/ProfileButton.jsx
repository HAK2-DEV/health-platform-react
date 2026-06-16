import { useNavigate } from 'react-router-dom'
import { User } from 'lucide-react'

// 우상단 프로필 진입 버튼 — 알림 종 옆에 동일 스타일로.
//   하단 탭에서 프로필 탭 제거(본인 결정) → 각 페이지 헤더로 프로필 진입.
function ProfileButton({ className = '' }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className={`w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-soft flex-shrink-0 hover:shadow-elevated transition ${className}`}
      title="프로필"
      onClick={() => navigate('/profile')}
    >
      <User className="w-4 h-4 text-gray-600" />
    </button>
  )
}

export default ProfileButton
