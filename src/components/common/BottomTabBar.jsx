import { NavLink } from 'react-router-dom'
import { Home, List, Trophy, Bell, User } from 'lucide-react'

// 5탭 하단 네비 — 본인 UI 레퍼런스 패턴 (SSRD F-LAYOUT-010)
// 세션 있을 때만 노출 (App.jsx 에서 분기)
function BottomTabBar() {
  const tabs = [
    { path: '/dashboard',     label: '홈',     icon: Home },
    { path: '/programs',      label: '프로그램', icon: List },
    { path: '/rankings',      label: '랭킹',   icon: Trophy },
    { path: '/notifications', label: '알림',   icon: Bell },
    { path: '/profile',       label: '프로필', icon: User },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-4xl mx-auto flex">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) => `
                flex-1 flex flex-col items-center gap-1 py-2 transition
                ${isActive
                  ? 'text-green-600'
                  : 'text-gray-500 hover:text-gray-700'}
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs">{tab.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomTabBar
