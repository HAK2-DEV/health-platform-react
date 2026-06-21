import { useNavigate } from 'react-router-dom'
import { User } from 'lucide-react'

// 우상단 프로필 진입 버튼 — 알림 종 옆에 동일 스타일로.
//   하단 탭에서 프로필 탭 제거(본인 결정) → 각 페이지 헤더로 프로필 진입.
function ProfileButton({ className = '', bare = false, showBack = false, compact = false }) {
  const navigate = useNavigate()
  const base = bare
    ? `${compact ? 'w-8 h-8' : 'w-9 h-9'} flex items-center justify-center flex-shrink-0 hover:text-gray-900 transition`
    : 'w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-soft flex-shrink-0 hover:shadow-elevated transition'
  return (
    <button
      type="button"
      className={`${base} ${className}`}
      title="프로필"
      onClick={() => navigate('/profile', showBack ? { state: { showBack: true } } : undefined)}
    >
      <User className={`${compact ? 'w-[18px] h-[18px]' : 'w-5 h-5'} text-gray-600`} />
    </button>
  )
}

export default ProfileButton
