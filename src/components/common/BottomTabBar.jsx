import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Home, List, Trophy, Bell, User } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchUnreadNotificationsCount } from '../../lib/queries'

// 5탭 하단 네비 — 본인 UI 레퍼런스 패턴 (SSRD F-LAYOUT-010)
// 세션 있을 때만 노출 (App.jsx 에서 분기)
// 🔔 알림 탭 — 안 읽은 알림 카운트 배지 (RLS 가 본인 알림만 SELECT)
function BottomTabBar() {
  const { session } = useAuth()
  const userId = session?.user?.id

  const { data: unreadCount = 0 } = useQuery({
    queryKey: queryKeys.notificationsUnread(userId),
    queryFn: fetchUnreadNotificationsCount,
    enabled: !!userId,
    // 다른 페이지에서 활동 시 (좋아요/댓글/심사) invalidate 로 자동 갱신
  })

  const tabs = [
    { path: '/dashboard',     label: '홈',     icon: Home },
    { path: '/programs',      label: '프로그램', icon: List },
    { path: '/rankings',      label: '랭킹',   icon: Trophy },
    { path: '/notifications', label: '알림',   icon: Bell, badge: unreadCount },
    { path: '/profile',       label: '프로필', icon: User },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-4xl mx-auto flex">
        {tabs.map(tab => {
          const Icon = tab.icon
          // hasBadge: 명시적 Boolean 으로 (tab.badge 가 0 이면 0 && ... 가 0 을 반환 → JSX 가 "0" 을 문자로 렌더링하는 함정)
          const hasBadge = tab.badge > 0
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) => `
                flex-1 flex flex-col items-center gap-1 py-2 transition relative
                ${isActive
                  ? 'text-green-600'
                  : 'text-gray-500 hover:text-gray-700'}
              `}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {hasBadge && (
                  <span className="absolute -top-2.5 -right-3 min-w-[20px] h-[20px] px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white shadow-md">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-xs">{tab.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomTabBar
