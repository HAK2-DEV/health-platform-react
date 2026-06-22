import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, ClipboardCheck, Sparkles, Compass } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchActivePrograms } from '../../lib/queries'

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

// 부채꼴(쿼터원) 한 조각 — 직각 꼭짓점이 + 버튼(돔 중앙 하단)에 오고 호가 바깥쪽으로 펼쳐짐.
//   레퍼런스 톤: 반투명 프로스티드 글래스 + 얇은 흰 테두리 + 흰 라인 아이콘.
//   side: 'left'(좌) | 'right'(우). R: 조각 크기(px).
const R = 132
function FanButton({ side, label, Icon, onClick, delay }) {
  const isLeft = side === 'left'
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ scale: 0.55, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.55, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26, delay }}
      className={`absolute bottom-0 flex items-end text-white overflow-hidden backdrop-blur-md
        bg-gradient-to-t from-white/[0.10] to-white/25 ring-1 ring-white/35
        shadow-[0_12px_40px_-10px_rgba(0,0,0,0.5)] active:bg-white/30 transition-colors
        ${isLeft ? 'right-1/2 mr-[5px] justify-start' : 'left-1/2 ml-[5px] justify-end'}`}
      style={{
        height: R, width: R,
        [isLeft ? 'borderTopLeftRadius' : 'borderTopRightRadius']: '100%',
        transformOrigin: isLeft ? 'bottom right' : 'bottom left',
      }}
    >
      {/* 라벨 — 쿼터원 무게중심 부근(직각 꼭짓점=+ 반대쪽)에 배치 */}
      <span
        className="absolute flex flex-col items-center gap-1.5 leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
        style={isLeft ? { left: R * 0.40, top: R * 0.44 } : { right: R * 0.40, top: R * 0.44 }}
      >
        <Icon className="w-[22px] h-[22px]" strokeWidth={1.8} />
        <span className="text-[12px] font-semibold whitespace-nowrap">{label}</span>
      </span>
    </motion.button>
  )
}

// 5탭 하단 네비 — 대시보드 / 프로그램 / 기록하기(+) / 랭킹 / 마이페이지
//   비활성: 꽉 찬 회색 아이콘 / 활성: 초록 아이콘 + 초록 글씨. (기록하기 + 버튼은 제외)
//   기록하기 +: 탭하면 뒤 블러 + 부채꼴 메뉴(인증하기 / 프로그램 생성하기) 펼침.
//     · 인증하기 → /record (참여 프로그램 없으면 RecordPage 가 둘러보기 안내, 있으면 1단계)
//     · 프로그램 생성하기 → /programs/new (프로그램 마법사)
function BottomTabBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuView, setMenuView] = useState('fan')   // 'fan' | 'noprogram'(참여 프로그램 없음 안내)

  // 인증하기 분기용 — 참여 중 프로그램 (대시보드/기록 쿼리와 캐시 공유)
  const { data: activePrograms = [], isLoading: isActiveLoading } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })

  // 라우트가 바뀌면 메뉴 닫기 (네비는 화면 전환에도 마운트 유지되므로 수동으로)
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  // 인증하기 — 참여 프로그램 없으면 부채꼴 대신 중앙 안내, 있으면 기록하기 1단계로
  const handleVerify = () => {
    if (isActiveLoading) { go('/record'); return }   // 로딩 중이면 RecordPage 가 알아서 분기
    if (activePrograms.length === 0) setMenuView('noprogram')
    else go('/record')
  }
  const openMenu = () => { setMenuView('fan'); setMenuOpen(o => !o) }

  const handleTabClick = (e, path) => {
    if (location.pathname === path) {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const go = (path) => { setMenuOpen(false); navigate(path) }

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
    <>
      {/* 부채꼴 메뉴 + 블러 오버레이 */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="rec-menu"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40"
          >
            {/* 블러 백드롭 — 탭하면 닫힘 */}
            <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />

            <AnimatePresence mode="wait">
              {menuView === 'fan' ? (
                // 부채꼴 컨테이너 — 화면 가로 중앙(=+버튼) 위 돔으로 펼침. 안내로 전환 시 아래로 사라짐.
                <motion.div
                  key="fan"
                  exit={{ y: 90, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeIn' }}
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{ bottom: 'calc(env(safe-area-inset-bottom) + 38px)', width: R * 2, height: R }}
                >
                  {/* + 둘레 부드러운 후광 링 (레퍼런스 중앙 halo) — 부채꼴 뒤, + 위치 부근 */}
                  <span
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-[74px] h-[74px] rounded-full bg-white/10 ring-1 ring-white/25 backdrop-blur-sm"
                    style={{ bottom: -24 }}
                  />
                  <FanButton side="left" label="인증하기" Icon={ClipboardCheck} delay={0} onClick={handleVerify} />
                  <FanButton side="right" label="프로그램 생성" Icon={Sparkles} delay={0.04} onClick={() => go('/programs/new')} />
                </motion.div>
              ) : (
                // 참여 프로그램 없음 — 화면 정중앙 안내 카드
                <motion.div
                  key="noprogram"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.06 }}
                  className="absolute inset-0 flex items-center justify-center p-6"
                  onClick={() => setMenuOpen(false)}
                >
                  <div className="w-full max-w-xs bg-white rounded-2xl px-6 py-7 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                      <Compass className="w-7 h-7 text-emerald-500" />
                    </div>
                    <p className="text-[15px] font-bold text-gray-800 leading-relaxed break-keep">
                      참여중인 프로그램이 없습니다.<br />프로그램을 먼저 참가해주세요!
                    </p>
                    <button
                      type="button"
                      onClick={() => go('/programs?tab=browse')}
                      className="mt-5 w-full h-12 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-bold transition"
                    >
                      프로그램 둘러보기
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-md mx-auto flex items-stretch">
          {renderTab(tabs[0])}
          {renderTab(tabs[1])}

          {/* 가운데 기록하기 — 떠 있는 + 버튼 → 부채꼴 메뉴 토글 (열리면 45° 회전해 X 느낌) */}
          <button
            type="button"
            onClick={openMenu}
            className="flex-1 flex items-center justify-center"
            aria-label="기록하기 메뉴"
            aria-expanded={menuOpen}
          >
            {/* 정적 래퍼가 위로 띄움(transform) → 내부 motion.span 은 회전만 담당 (transform 충돌 방지) */}
            <span className="-translate-y-[18px]">
              <motion.span
                animate={{ rotate: menuOpen ? 45 : 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                className="flex w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white items-center justify-center shadow-lg shadow-emerald-500/40 active:scale-95"
              >
                <Plus className="w-6 h-6" strokeWidth={2.5} />
              </motion.span>
            </span>
          </button>

          {renderTab(tabs[2])}
          {renderTab(tabs[3])}
        </div>
      </nav>
    </>
  )
}

export default BottomTabBar
