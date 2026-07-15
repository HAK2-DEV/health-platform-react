import { useState, useEffect, useRef } from 'react'
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
// 화분(성장) — Material Symbols(본인 제공). viewBox 0 -960 960 960, fill=currentColor.
const PlantSolid = ({ className }) => (
  <svg viewBox="0 -960 960 960" fill="currentColor" className={className} aria-hidden="true">
    <path d="M342-160h276l40-160H302l40 160Zm0 80q-28 0-49-17t-28-44l-45-179h520l-45 179q-7 27-28 44t-49 17H342ZM200-400h560v-80H200v80Zm280-240q0-100 70-170t170-70q0 90-57 156t-143 80v84h320v160q0 33-23.5 56.5T760-320H200q-33 0-56.5-23.5T120-400v-160h320v-84q-86-14-143-80t-57-156q100 0 170 70t70 170Z" />
  </svg>
)

// 부채꼴(쿼터원) 한 조각 — 직각 꼭짓점이 + 버튼(돔 중앙 하단)에 오고 호가 바깥쪽으로 펼쳐짐.
//   라이트 그레이 조각 + 중앙 그린 버튼 둘레를 마스크로 도려내(컷아웃) 도넛형 돔.
//   side: 'left'(좌) | 'right'(우). R: 조각 크기(px). CUT: 중앙 컷아웃 반경(px).
const R = 132
const CUT = 47
function FanButton({ side, label, Icon, delay, active = false }) {
  const isLeft = side === 'left'
  // 중앙(그린 버튼) 쪽 꼭짓점에서 원형으로 도려냄 → 라디얼 그라데이션 마스크
  const maskAt = isLeft ? '100% 100%' : '0% 100%'
  const mask = `radial-gradient(circle at ${maskAt}, transparent ${CUT}px, #000 ${CUT + 0.5}px)`
  // 입력은 컨테이너가 캡처(좌우 판별) → 조각은 pointer-events-none. active 면 살짝 커짐.
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: active ? 1.1 : 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24, delay }}
      className={`absolute bottom-0 flex items-end text-gray-600 pointer-events-none
        ${isLeft ? 'right-1/2 mr-[6px] justify-start' : 'left-1/2 ml-[6px] justify-end'}`}
      style={{
        height: R, width: R,
        background: active ? '#cdd1d7' : '#d7dadf',
        [isLeft ? 'borderTopLeftRadius' : 'borderTopRightRadius']: '100%',
        WebkitMaskImage: mask,
        maskImage: mask,
        filter: active ? 'drop-shadow(0 12px 22px rgba(0,0,0,0.24))' : 'drop-shadow(0 8px 16px rgba(0,0,0,0.18))',
        transformOrigin: isLeft ? 'bottom right' : 'bottom left',
      }}
    >
      {/* 라벨 — 부채꼴 방향으로 회전 배치(호를 따라 비스듬히) → 곡선 안에 들어가 잘림 방지 */}
      <span
        className="absolute flex flex-col items-center gap-1 leading-tight text-center"
        style={isLeft
          ? { left: R * 0.60, top: R * 0.56, transform: 'translate(-50%, -50%) rotate(-35deg)' }
          : { left: R * 0.40, top: R * 0.56, transform: 'translate(-50%, -50%) rotate(35deg)' }}
      >
        <Icon className="w-[21px] h-[21px]" strokeWidth={1.9} />
        <span className="text-[11px] font-bold whitespace-nowrap">{label}</span>
      </span>
    </motion.div>
  )
}

// 5탭 하단 네비 — 대시보드 / 프로그램 / 기록하기(+) / 랭킹 / 마이페이지
//   비활성: 꽉 찬 회색 아이콘 / 활성: 초록 아이콘 + 초록 글씨. (기록하기 + 버튼은 제외)
//   기록하기 +: 탭하면 뒤 블러 + 부채꼴 메뉴(기록하기 / 프로그램 생성하기) 펼침.
//     · 기록하기 → /record (참여 프로그램 없으면 RecordPage 가 둘러보기 안내, 있으면 1단계)
//     · 프로그램 생성하기 → /programs/new (프로그램 마법사)
function BottomTabBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuView, setMenuView] = useState('fan')   // 'fan' | 'noprogram'(참여 프로그램 없음 안내)
  const [pressedSide, setPressedSide] = useState(null)  // 'left' | 'right' | null — 꾹 눌러 선택 중인 조각
  const pressingRef = useRef(false)

  // 기록하기 분기용 — 참여 중 프로그램 (대시보드/기록 쿼리와 캐시 공유)
  const { data: activePrograms = [], isLoading: isActiveLoading } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })

  // 라우트가 바뀌면 메뉴 닫기 (네비는 화면 전환에도 마운트 유지되므로 수동으로)
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  // 기록하기— 참여 프로그램 없으면 부채꼴 대신 중앙 안내, 있으면 기록하기 1단계로
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

  // 부채꼴 꾹 누르기 + 좌우 슬라이드 선택 — 컨테이너가 포인터 캡처해 x 위치로 좌/우 판별.
  //   누른 조각이 살짝 커지고(active), 손가락을 옮기면 그쪽으로 active 가 따라옴. 떼면 해당 액션.
  const dispatchSide = (side) => { if (side === 'left') handleVerify(); else go('/programs/new') }
  const sideAtX = (el, clientX) => {
    const r = el.getBoundingClientRect()
    return clientX < r.left + r.width / 2 ? 'left' : 'right'
  }
  const onFanDown = (e) => {
    pressingRef.current = true
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* 미지원 무시 */ }
    setPressedSide(sideAtX(e.currentTarget, e.clientX))
  }
  const onFanMove = (e) => {
    if (!pressingRef.current) return
    setPressedSide(sideAtX(e.currentTarget, e.clientX))
  }
  const onFanUp = (e) => {
    if (!pressingRef.current) return
    pressingRef.current = false
    const side = sideAtX(e.currentTarget, e.clientX)
    setPressedSide(null)
    dispatchSide(side)
  }
  const onFanCancel = () => { pressingRef.current = false; setPressedSide(null) }

  const tabs = [
    { path: '/dashboard', label: '대시보드', Icon: HomeSolid },
    { path: '/programs', label: '프로그램', Icon: FlagSolid },
    // 화분(Material Symbols)은 viewBox 를 꽉 채워 크게 보임 → 살짝 줄여 다른 탭과 시각 크기 맞춤
    { path: '/growth', label: '성장', Icon: PlantSolid, iconCls: 'w-[21px] h-[21px]' },
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
      <tab.Icon className={tab.iconCls || 'w-6 h-6'} />
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
            transition={{ duration: 0.32, ease: 'easeOut' }}
            className="fixed inset-0 z-40"
          >
            {/* 블러 백드롭 — 탭하면 닫힘. 바깥 컨테이너 opacity(0.32s)로 블러가 서서히 드러남 */}
            <div className="absolute inset-0 bg-black/25 backdrop-blur-md" onClick={() => setMenuOpen(false)} />

            <AnimatePresence mode="wait">
              {menuView === 'fan' ? (
                // 부채꼴 컨테이너 — 화면 가로 중앙(=+버튼) 위 돔으로 펼침. 안내로 전환 시 아래로 사라짐.
                <motion.div
                  key="fan"
                  exit={{ y: 90, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeIn' }}
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{ bottom: 'calc(env(safe-area-inset-bottom) + 68px)', width: R * 2, height: R, touchAction: 'none' }}
                  onPointerDown={onFanDown}
                  onPointerMove={onFanMove}
                  onPointerUp={onFanUp}
                  onPointerCancel={onFanCancel}
                >
                  <FanButton side="left" label="기록하기" Icon={ClipboardCheck} delay={0} active={pressedSide === 'left'} />
                  <FanButton side="right" label="프로그램 생성" Icon={Sparkles} delay={0.04} active={pressedSide === 'right'} />
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
            {/* 정적 래퍼가 위로 띄움(transform) → 내부 motion.span 이 회전+확대+상승 담당 */}
            <span className="-translate-y-[18px]">
              <motion.span
                animate={{ rotate: menuOpen ? 45 : 0, scale: menuOpen ? 1.28 : 1, y: menuOpen ? -22 : 0 }}
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
