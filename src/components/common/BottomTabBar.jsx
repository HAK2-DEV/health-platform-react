import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'

// 채워진(solid) 탭 아이콘 — fill=currentColor 라 text-* 로 색 제어 (heroicons solid, MIT)
const HomeSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 11-1.06 1.06l-.69-.69v6.81a1.5 1.5 0 01-1.5 1.5h-3a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-1.5a.75.75 0 00-.75.75v4.5a.75.75 0 01-.75.75h-3a1.5 1.5 0 01-1.5-1.5v-6.81l-.69.69a.75.75 0 01-1.06-1.06l8.69-8.69z" />
  </svg>
)
const FlagSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.77l-.108-.054a8.25 8.25 0 00-5.69-.625l-2.202.55V21a.75.75 0 01-1.5 0V3A.75.75 0 013 2.25z" />
  </svg>
)
const ChartSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M18.75 3.75a.75.75 0 00-.75.75v15c0 .414.336.75.75.75h.75a.75.75 0 00.75-.75v-15a.75.75 0 00-.75-.75h-.75zM11.625 7.5a.75.75 0 00-.75.75v11.25c0 .414.336.75.75.75h.75a.75.75 0 00.75-.75V8.25a.75.75 0 00-.75-.75h-.75zM4.5 11.25a.75.75 0 00-.75.75v7.5c0 .414.336.75.75.75h.75a.75.75 0 00.75-.75V12a.75.75 0 00-.75-.75H4.5z" />
  </svg>
)
const UserSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" />
  </svg>
)

// 5탭 하단 네비 — 대시보드 / 프로그램 / 기록하기(+) / 랭킹 / 마이페이지
//   비활성: 꽉 찬 회색 아이콘 / 활성: 초록 아이콘 + 초록 글씨. (기록하기 + 버튼은 제외)
//   기록하기: /record 로 이동 (오늘의 기록 통합 목록, 미션 1개면 바로 인증).
function BottomTabBar() {
  const location = useLocation()
  const navigate = useNavigate()

  const handleTabClick = (e, path) => {
    if (location.pathname === path) {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const tabs = [
    { path: '/dashboard', label: '대시보드', Icon: HomeSolid },
    { path: '/programs', label: '프로그램', Icon: FlagSolid },
    { path: '/rankings', label: '랭킹', Icon: ChartSolid },
    { path: '/profile', label: '마이페이지', Icon: UserSolid },
  ]

  const renderTab = (tab) => (
    <NavLink
      key={tab.path}
      to={tab.path}
      onClick={(e) => handleTabClick(e, tab.path)}
      className={({ isActive }) => `
        flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition
        ${isActive ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-500'}
      `}
    >
      <tab.Icon className="w-6 h-6" />
      <span className="text-[11px] font-medium">{tab.label}</span>
    </NavLink>
  )

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-md mx-auto flex items-stretch">
        {renderTab(tabs[0])}
        {renderTab(tabs[1])}

        {/* 가운데 기록하기 — 떠 있는 + 버튼 → /record */}
        <button
          type="button"
          onClick={() => navigate('/record')}
          className="flex-1 flex flex-col items-center justify-end gap-0.5 pb-2"
        >
          <span className="-mt-5 w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 active:scale-95 transition">
            <Plus className="w-6 h-6" strokeWidth={2.5} />
          </span>
          <span className="text-[11px] font-medium text-gray-500">기록하기</span>
        </button>

        {renderTab(tabs[2])}
        {renderTab(tabs[3])}
      </div>
    </nav>
  )
}

export default BottomTabBar
