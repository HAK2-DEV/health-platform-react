import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchUnreadNotificationsCount } from '../../lib/queries'

// 우상단 알림 종 — 홈/프로그램/랭킹/프로필 헤더 공용.
//   하단 탭에서 알림 탭을 제거(본인 결정)하여, 각 페이지 헤더로 알림 진입.
//   안 읽은 알림 카운트 배지 (다른 화면 활동 시 invalidate 로 자동 갱신).
function NotificationBell({ className = '', bare = false, showBack = false, compact = false }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id

  const { data: unreadCount = 0 } = useQuery({
    queryKey: queryKeys.notificationsUnread(userId),
    queryFn: fetchUnreadNotificationsCount,
    enabled: !!userId,
  })

  // bare: 흰 원/그림자 없이 아이콘만 (헤더 등). compact: 살짝 작게.
  const base = bare
    ? `relative ${compact ? 'w-8 h-8' : 'w-9 h-9'} flex items-center justify-center flex-shrink-0 hover:text-gray-900 transition`
    : 'relative w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-soft flex-shrink-0 hover:shadow-elevated transition'

  return (
    <button
      type="button"
      className={`${base} ${className}`}
      title="알림"
      onClick={() => navigate('/notifications', showBack ? { state: { showBack: true } } : undefined)}
    >
      <Bell className={`${compact ? 'w-[18px] h-[18px]' : 'w-5 h-5'} text-gray-600`} />
      {unreadCount > 0 && (
        <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white shadow-md">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}

export default NotificationBell
