import { NavLink, useLocation } from 'react-router-dom'
import { Home, List } from 'lucide-react'

// 4탭 하단 네비 — 본인 UI 레퍼런스 패턴 (SSRD F-LAYOUT-010)
// 세션 있을 때만 노출 (App.jsx 에서 분기)
// 알림 탭 제거(본인 결정) — 알림은 홈 화면 우상단 종 아이콘으로 진입.
// 동일 탭 재탭 시 부드러운 스크롤 to top (카카오톡/인스타 패턴)
function BottomTabBar() {
  const location = useLocation()

  // 현재 탭을 다시 누르면 페이지 상단으로 부드럽게 스크롤
  //   다른 탭으로 가는 경우는 App.jsx 의 pathname useEffect 가 즉시 0,0 으로 reset
  const handleTabClick = (e, path) => {
    if (location.pathname === path) {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const tabs = [
    { path: '/dashboard', label: '홈',      icon: Home },
    { path: '/programs',  label: '프로그램', icon: List },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 pb-3"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
    >
      <div className="max-w-4xl mx-auto flex">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              onClick={(e) => handleTabClick(e, tab.path)}
              className={({ isActive }) => `
                flex-1 flex flex-col items-center gap-1 py-2 transition relative
                ${isActive
                  ? 'text-emerald-600'
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
