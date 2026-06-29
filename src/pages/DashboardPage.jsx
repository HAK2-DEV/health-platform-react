import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { Bell, ChevronRight, Calendar } from 'lucide-react'
import { supabase } from '../supabaseClient'
import ProgramDetailModal from '../components/program/ProgramDetailModal'
import ProgramBrowseModal from '../components/program/ProgramBrowseModal'
import WelcomeOperatorModal from '../components/program/WelcomeOperatorModal'
import ProgramCover from '../components/common/ProgramCover'
import CountUp from '../components/common/CountUp'
import LoadingState from '../components/common/LoadingState'
import EmptyState from '../components/common/EmptyState'
import { calcProgress, progressUrgency } from '../lib/programVisuals'
import { formatKoreanDate } from '../lib/formatters'
import {
  queryKeys,
  fetchMyPrograms,
  fetchActivePrograms,
  fetchActiveParticipantCounts,
  fetchPublicPrograms,
  fetchUnreadNotificationsCount,
  fetchMyParticipantStats,
  fetchMyTodayActivity,
  fetchMyRankChange,
  fetchProgramOverview,
  fetchProgramOperatorPulse,
} from '../lib/queries'

// 채워진(solid) 통계 아이콘 — fill=currentColor 라 text-* 로 색 (heroicons solid, MIT)
const UsersSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157v.003Z" />
  </svg>
)
const TrophySolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 0 0-.584.859 6.753 6.753 0 0 0 6.138 5.6 6.73 6.73 0 0 0 2.743 1.347A6.707 6.707 0 0 1 9.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a2.25 2.25 0 0 0-2.25 2.25c0 .414.336.75.75.75h15a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-2.25-2.25h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.706 6.706 0 0 1-1.112-3.173 6.73 6.73 0 0 0 2.743-1.347 6.753 6.753 0 0 0 6.139-5.6.75.75 0 0 0-.585-.858 47.077 47.077 0 0 0-3.07-.543V2.62a.75.75 0 0 0-.658-.744 49.22 49.22 0 0 0-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 0 0-.657.744ZM5.166 5.25c0 1.196.312 2.32.857 3.294A5.266 5.266 0 0 1 3.16 5.337a45.6 45.6 0 0 1 2.006-.343V5.25Zm13.5 0v-.256c.674.1 1.343.214 2.006.343a5.265 5.265 0 0 1-2.863 3.207 6.72 6.72 0 0 0 .857-3.294Z" />
  </svg>
)
const CalendarSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Z" />
  </svg>
)
const FlagSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M3 2.25a.75.75 0 0 1 .75.75v.54l1.838-.46a9.75 9.75 0 0 1 6.725.738l.108.054a8.25 8.25 0 0 0 5.58.652l3.109-.732a.75.75 0 0 1 .917.81 47.784 47.784 0 0 0 .005 10.337.75.75 0 0 1-.574.812l-3.114.733a9.75 9.75 0 0 1-6.594-.77l-.108-.054a8.25 8.25 0 0 0-5.69-.625l-2.202.55V21a.75.75 0 0 1-1.5 0V3A.75.75 0 0 1 3 2.25Z" />
  </svg>
)
const ClipboardSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-.673-.05A3 3 0 0 0 15 1.5h-1.5a3 3 0 0 0-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6ZM13.5 3A1.5 1.5 0 0 0 12 4.5h4.5A1.5 1.5 0 0 0 15 3h-1.5Z" clipRule="evenodd" />
    <path fillRule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 0 1 3 20.625V9.375ZM6 12a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H6.75a.75.75 0 0 1-.75-.75V12Zm2.25 0a.75.75 0 0 1 .75-.75h3.75a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75ZM6 15a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H6.75a.75.75 0 0 1-.75-.75V15Zm2.25 0a.75.75 0 0 1 .75-.75h3.75a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75ZM6 18a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H6.75a.75.75 0 0 1-.75-.75V18Zm2.25 0a.75.75 0 0 1 .75-.75h3.75a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
  </svg>
)

// 섹션 카드 — 모서리 10px, 제목 + 우측 액션. 진입 시 아래에서 살짝 떠오름(stagger).
// 카드는 항상 보임(페이드인 없음) — 깜빡임 방지. 모션은 내부 숫자·바·링만 (마이페이지와 동일).
function SectionCard({ title, action, children, className = '' }) {
  return (
    <section
      className={`bg-white rounded-[10px] shadow-elevated p-4 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          {title && <h2 className="flex items-center gap-1.5 text-base font-bold text-gray-800">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

// 운영중/참여중 콘텐츠를 좌우로만 밀어내는 캐러셀 — 카드 프레임은 그대로, 안쪽만 슬라이드.
//   하단 CTA처럼 "새 내용이 옆에서 미끄러져 들어와 멈춤". 이전 내용은 슬라이드로 나가지 않고 바로 교체.
//   AnimatePresence 없이 key 만 바꿔 새 motion.div 가 initial→animate 로 들어옴.
//   dir===0(첫 로드, 토글 전)일 땐 슬라이드 없이 그대로(섹션 등장 모션만).
function ModeSlide({ mode, dir, children }) {
  return (
    <div className="overflow-hidden">
      <motion.div
        key={mode}
        initial={{ x: dir === 0 ? 0 : (dir > 0 ? '55%' : '-55%') }}
        animate={{ x: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </div>
  )
}

// 내 랭킹 도넛 링 — 화면에 들어오면 원이 그려짐 (마이페이지 카운트업처럼 매번 재생)
function RankRing({ rank, total }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -12% 0px' })
  const R = 30
  const C = 2 * Math.PI * R
  const pct = (rank && total) ? Math.max(0.04, Math.min(1, (total - rank + 1) / total)) : 0
  return (
    <div ref={ref} className="relative w-[84px] h-[84px]">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={R} fill="none" stroke="#e5e7eb" strokeWidth="7" />
        <motion.circle cx="40" cy="40" r={R} fill="none" stroke="#10b981" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: inView ? C * (1 - pct) : C }}
          transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] text-emerald-600 font-semibold leading-none">내 랭킹</span>
        <span className="text-lg font-extrabold text-gray-900 leading-tight">{rank ? `${rank}등` : '-'}</span>
        <span className="text-[10px] text-gray-400 leading-none">/ {total || '-'}명</span>
      </div>
    </div>
  )
}

// 신규 사용자 콜드스타트 가이드 — 운영·참여 프로그램이 0개일 때 대표/활동/랭킹 3섹션을 대체.
// 죽은 0/0/0 카드 대신 둘러보기→참여→인증 「시작 3단계」 동선을 안내한다 (참여자 온보딩 A).
function ColdStartGuide({ onBrowse }) {
  const steps = [
    { n: 1, emoji: '🔍', title: '프로그램 둘러보기', body: '관심 있는 건강 프로그램을 찾아봐요.' },
    { n: 2, emoji: '🙌', title: '마음에 드는 곳에 참여', body: '공개 프로그램은 바로, 비공개는 초대코드로 참여해요.' },
    { n: 3, emoji: '✅', title: '매일 미션 인증', body: '사진·기록으로 인증하며 건강 습관을 쌓아요.' },
  ]
  return (
    <SectionCard>
      <div className="text-center mb-4">
        <div className="text-4xl mb-2">🌱</div>
        <h2 className="text-lg font-extrabold text-gray-900 leading-tight">건강 습관, 여기서 시작해요!</h2>
        <p className="text-[13px] text-gray-500 mt-1">3단계면 충분해요. 첫 프로그램을 찾아볼까요?</p>
      </div>
      <ol className="space-y-3 mb-5">
        {steps.map((s, i) => (
          <motion.li
            key={s.n}
            className="flex items-start gap-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.1 }}
          >
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold flex items-center justify-center">{s.n}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-800">{s.emoji} {s.title}</p>
              <p className="text-[12px] text-gray-500 leading-snug">{s.body}</p>
            </div>
          </motion.li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onBrowse}
        className="w-full py-3 rounded-card-lg bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-semibold transition flex items-center justify-center gap-1"
      >
        프로그램 둘러보기 <ChevronRight className="w-4 h-4" />
      </button>
    </SectionCard>
  )
}

function DashboardPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const userId = session?.user?.id

  const [selectedPublicId, setSelectedPublicId] = useState(null)
  const [browseOpen, setBrowseOpen] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  // 대표 카드 모드 토글 (운영중 ⇄ 참여중) — 둘 다 있을 때 스와이프로 전환
  const [viewMode, setViewMode] = useState('operator')
  const [modeDir, setModeDir] = useState(0)
  const modeTouch = useRef({ x: 0, y: 0 })
  const swipedRef = useRef(false)

  useEffect(() => {
    if (session === null) navigate('/login')
  }, [session, navigate])

  useEffect(() => {
    if (sessionStorage.getItem('show_operator_welcome') === '1') {
      sessionStorage.removeItem('show_operator_welcome')
      localStorage.setItem('operator_welcome_seen', '1')
      setShowWelcome(true)
    }
  }, [])

  // ─── 데이터 ───────────
  const { data: nickname } = useQuery({
    queryKey: ['user-nickname', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('nickname').eq('id', userId).maybeSingle()
      if (error) throw error
      return data?.nickname || ''
    },
    enabled: !!userId,
  })

  const { data: myPrograms = [], isLoading: isMyLoading } = useQuery({
    queryKey: queryKeys.myPrograms(userId),
    queryFn: () => fetchMyPrograms(userId),
    enabled: !!userId,
  })

  const { data: activePrograms = [], isLoading: isActiveLoading } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })

  // 참여자 수 — 참여 프로그램 + 운영 프로그램(대표 카드가 운영중일 때 참여자 수 표시) 모두 집계
  const activeProgramIds = [...new Set([...activePrograms.map(p => p.id), ...myPrograms.map(p => p.id)])]
  const { data: activeCounts = {} } = useQuery({
    queryKey: queryKeys.activeParticipantCounts(activeProgramIds),
    queryFn: () => fetchActiveParticipantCounts(activeProgramIds),
    enabled: activeProgramIds.length > 0,
  })

  const { data: publicPrograms = [] } = useQuery({
    queryKey: queryKeys.publicPrograms(userId),
    queryFn: () => fetchPublicPrograms(userId),
    enabled: !!userId,
  })

  const { data: unreadNotifCount = 0 } = useQuery({
    queryKey: queryKeys.notificationsUnread(userId),
    queryFn: fetchUnreadNotificationsCount,
    enabled: !!userId,
  })

  const { data: pStats } = useQuery({
    queryKey: queryKeys.myParticipantStats(userId),
    queryFn: () => fetchMyParticipantStats(userId),
    enabled: !!userId,
  })

  const { data: today } = useQuery({
    queryKey: queryKeys.myTodayActivity(userId),
    queryFn: () => fetchMyTodayActivity(userId),
    enabled: !!userId,
  })

  // 운영자(소유 프로그램 보유)면 대표 카드에 운영중 프로그램을, 아니면 참여중 프로그램을 노출.
  //   운영중·참여중 둘 다 있으면 스와이프/토글로 전환(effectiveMode).
  const isOperator = myPrograms.length > 0
  // 신규 사용자 콜드스타트 — 운영·참여 프로그램이 하나도 없고 로딩도 끝난 상태.
  // 죽은 0/0/0 대시보드 대신 「시작 3단계」 가이드로 전환 (참여자 온보딩).
  const isColdStart = !isMyLoading && !isActiveLoading && myPrograms.length === 0 && activePrograms.length === 0
  const canToggleMode = myPrograms.length > 0 && activePrograms.length > 0
  const effectiveMode = canToggleMode ? viewMode : (isOperator ? 'operator' : 'participant')
  const showOperator = effectiveMode === 'operator'
  const featured = showOperator ? (myPrograms[0] || null) : (activePrograms[0] || null)
  // 모드 전환 (방향 기록 → 슬라이드 페이드)
  const switchMode = (m) => {
    if (!canToggleMode || m === effectiveMode) return
    setModeDir(m === 'participant' ? 1 : -1)
    setViewMode(m)
  }
  const onModeTouchStart = (e) => { swipedRef.current = false; const t = e.touches[0]; modeTouch.current = { x: t.clientX, y: t.clientY } }
  const onModeTouchEnd = (e) => {
    if (!canToggleMode) return
    const t = e.changedTouches[0]
    const dx = t.clientX - modeTouch.current.x
    const dy = t.clientY - modeTouch.current.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swipedRef.current = true   // 카드 탭(네비게이션) 억제
      switchMode(dx < 0 ? 'participant' : 'operator')
    }
  }
  const { data: featuredRank } = useQuery({
    queryKey: queryKeys.myRankChange(featured?.id, userId),
    queryFn: () => fetchMyRankChange(featured.id),
    enabled: !!featured?.id && !!userId,
  })
  const { data: featuredOverview } = useQuery({
    queryKey: queryKeys.programOverview(featured?.id, userId),
    queryFn: () => fetchProgramOverview(featured.id, userId),
    enabled: !!featured?.id && !!userId,
  })
  // 운영중 카드 지표 — 오늘 참여(고유 인증자) + 누적 인증. 운영자일 때만.
  const { data: opPulse } = useQuery({
    queryKey: queryKeys.programOperatorPulse(featured?.id),
    queryFn: () => fetchProgramOperatorPulse(featured.id),
    enabled: showOperator && !!featured?.id,
  })

  // ─── 파생 ─────────

  const fProgress = featured ? calcProgress(featured.start_date, featured.end_date) : 0
  const fUrgency = featured ? progressUrgency(fProgress) : null
  const daysLeft = (() => {
    if (!featured?.end_date) return null
    const end = new Date(`${featured.end_date}T23:59:59+09:00`)
    return Math.max(0, Math.ceil((end - new Date()) / 86400000))
  })()
  const achieveRate = (() => {
    if (!featured?.start_date) return null
    const start = new Date(`${featured.start_date}T00:00:00+09:00`)
    const elapsed = Math.max(1, Math.round((new Date() - start) / 86400000) + 1)
    return Math.min(100, Math.round(((featuredOverview?.activeDays ?? 0) / elapsed) * 100))
  })()

  const featuredParticipants = featured ? (activeCounts[featured.id] ?? null) : null

  // 운영중 카드 지표 파생 — 오늘 참여율(오늘 인증자 ÷ 참여자) / 누적 인증
  const todayRate = opPulse == null
    ? null
    : (featuredParticipants && featuredParticipants > 0)
      ? Math.round((opPulse.todayActiveUsers / featuredParticipants) * 100)
      : 0
  const totalVerifs = opPulse?.totalVerifs ?? null

  // 첫 인증 넛지 — 참여자(운영 모드 아님)인데 대표 프로그램에 승인된 인증이 0건(활성화 전).
  //   featuredOverview 로딩 중엔 undefined → 조건 false 라 깜빡임 없음.
  const firstVerifyNudge = !isColdStart && !showOperator && !!featured && featuredOverview?.totalCount === 0

  // 대표 프로그램 4지표 (숫자 12px / 단위 9px / 색상은 지표별)
  //   운영중: 참여자 / 오늘 참여율 / 남은 기간 / 누적 인증
  //   참여중: 참여자 / 내 순위 / 남은 기간 / 목표 달성률
  const fStats = showOperator ? [
    { icon: UsersSolid, label: '참여자', num: featuredParticipants != null ? `${featuredParticipants}` : '-', unit: featuredParticipants != null ? '명' : '', color: 'text-emerald-600' },
    { icon: FlagSolid, label: '오늘 참여율', num: todayRate != null ? `${todayRate}` : '-', unit: todayRate != null ? '%' : '', color: 'text-emerald-600' },
    { icon: CalendarSolid, label: '남은 기간', num: daysLeft != null ? `${daysLeft}` : '상시', unit: daysLeft != null ? '일' : '', color: 'text-gray-900' },
    { icon: ClipboardSolid, label: '누적 인증', num: totalVerifs != null ? `${totalVerifs}` : '-', unit: totalVerifs != null ? '건' : '', color: 'text-gray-900' },
  ] : [
    { icon: UsersSolid, label: '참여자', num: featuredParticipants != null ? `${featuredParticipants}` : '-', unit: featuredParticipants != null ? '명' : '', color: 'text-emerald-600' },
    { icon: TrophySolid, label: '내 순위', num: featuredRank?.current_rank ? `${featuredRank.current_rank}` : '-', unit: featuredRank?.current_rank ? '등' : '', color: 'text-gray-900' },
    { icon: CalendarSolid, label: '남은 기간', num: daysLeft != null ? `${daysLeft}` : '상시', unit: daysLeft != null ? '일' : '', color: 'text-gray-900' },
    { icon: FlagSolid, label: '목표 달성률', num: achieveRate != null ? `${achieveRate}` : '-', unit: achieveRate != null ? '%' : '', color: 'text-emerald-600' },
  ]

  // 오늘의 활동 (값 / 소프트 캡 → 막대 비율)
  const todayMetrics = [
    { label: '미션 완료', value: today?.missionCount ?? 0, cap: 8, img: '/icons/activity/mission.png', bar: 'bg-emerald-500' },
    { label: '기록 작성', value: today?.recordCount ?? 0, cap: 5, img: '/icons/activity/record.png', bar: 'bg-blue-500', scale: 1.7 },
    { label: '댓글 활동', value: today?.commentCount ?? 0, cap: 10, img: '/icons/activity/comment.png', bar: 'bg-amber-500' },
    { label: '획득 점수', value: today?.points ?? 0, cap: 300, img: '/icons/activity/point.png', bar: 'bg-purple-500', circleBg: 'bg-amber-100' },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* ─── 상단 헤더 (도담 + 알림) — 모서리 0, 최상단 고정 톤 ─── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto h-[46px] px-4 flex items-center justify-center relative">
          <div className="flex items-center gap-1.5">
            <img src="/app-icon.png" onError={(e) => { e.currentTarget.style.display = 'none' }} alt="" className="w-5 h-5 rounded-md" />
            <span className="text-[17px] font-bold text-gray-800">건강증진 플랫폼</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            className="absolute right-3 w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition"
            title="알림"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white">
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 콘텐츠 — 간격 9px */}
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 pt-[9px] pb-6 space-y-[9px]">

        {/* ─── 인사말 헤더 (이미지 카드, 모서리 10) — 페이드 없이 항상 보임 ─── */}
        <div className="relative overflow-hidden rounded-[10px] bg-[#eef7f1] h-[120px]">
          {/* 일러스트 — object-cover + 상단 기준(머리 안 잘리게) → 인물 크게 (사진2처럼) */}
          <img
            src="/home-header.jpg"
            alt=""
            aria-hidden="true"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: 'center 56%' }}
          />
          {/* 좌측은 배경색으로 덮고(텍스트 또렷·이음새 가림), 우측 인물로 갈수록 투명 */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to right, #eef7f1 0%, #eef7f1 50%, rgba(238,247,241,0) 72%)' }}
          />
          {/* 텍스트 — 세로 균등 간격(gap-[8px] 한 곳에서 조절) */}
          <div className="relative h-full px-4 flex flex-col justify-center gap-[8px]">
            <p className="text-[13px] font-medium text-gray-700 leading-tight drop-shadow-sm">
              오늘도 건강한 하루 되세요! 👋
            </p>
            <p className="text-2xl font-extrabold text-gray-900 leading-tight drop-shadow-sm">
              {nickname ? `${nickname}님` : '반가워요'}
            </p>
            <div className="flex items-center gap-1.5">
              {isOperator && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold">
                  운영자
                </span>
              )}
              <span className="text-[12px] font-medium text-gray-700">{isColdStart ? '환영해요! 첫 건강 습관을 시작해볼까요? ✨' : '건강한 습관이 쌓이고 있어요!'}</span>
            </div>
          </div>
        </div>

        {/* 첫 인증 넛지 — 참여했지만 아직 한 번도 인증 안 한 사용자를 미션 탭으로 (활성화) */}
        {firstVerifyNudge && (
          <button
            type="button"
            onClick={() => navigate(`/programs/${featured.id}?tab=missions`)}
            className="w-full flex items-center gap-3 p-3.5 rounded-[10px] bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-left shadow-elevated active:scale-[0.99] transition"
          >
            <span className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">🎯</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">아직 첫 인증 전이에요!</p>
              <p className="text-[12px] text-white/85 leading-snug mt-0.5 truncate">{featured.name}에서 첫 미션을 인증하고 습관을 시작해보세요</p>
            </div>
            <ChevronRight className="w-5 h-5 flex-shrink-0 text-white/90" />
          </button>
        )}

        {/* 신규 사용자 — 죽은 0/0/0 섹션 대신 시작 가이드 히어로 */}
        {isColdStart ? (
        <ColdStartGuide onBrowse={() => setBrowseOpen(true)} />
        ) : (<>
        {/* ─── 운영중/참여중 전환 3개 섹션 — 프레임 고정, 안쪽만 좌우 슬라이드 ─── */}
        <div className="space-y-[9px]" onTouchStart={onModeTouchStart} onTouchEnd={onModeTouchEnd}>
        {/* ─── 대표 프로그램 (운영자=운영중 / 그 외=참여중) ─── */}
        <SectionCard
          title={canToggleMode ? (
            <span className="inline-flex items-center gap-0.5 bg-gray-100 rounded-full p-0.5">
              <button type="button" onClick={() => switchMode('operator')} className={`px-2.5 py-1 rounded-full text-[12px] font-bold transition ${showOperator ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>운영중</button>
              <button type="button" onClick={() => switchMode('participant')} className={`px-2.5 py-1 rounded-full text-[12px] font-bold transition ${!showOperator ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>참여중</button>
            </span>
          ) : (showOperator ? '운영 중인 프로그램' : '참여 중인 프로그램')}
          action={(showOperator ? myPrograms.length : activePrograms.length) > 0 && (
            <button type="button" onClick={() => navigate(showOperator ? '/programs?tab=mine' : '/programs')} className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700">
              전체 보기 {(showOperator ? myPrograms.length : activePrograms.length) > 1 && `(${showOperator ? myPrograms.length : activePrograms.length})`}<ChevronRight className="w-3 h-3" />
            </button>
          )}
        >
          <ModeSlide mode={effectiveMode} dir={modeDir}>
          {isActiveLoading ? (
            <LoadingState size="sm" />
          ) : !featured ? (
            <EmptyState
              icon="🎯"
              title="참여 중인 프로그램이 없어요"
              description="새로운 건강 프로그램에 참여해보세요"
              action={{ label: '프로그램 둘러보기', onClick: () => setBrowseOpen(true) }}
              variant="mint"
              size="lg"
            />
          ) : (
            <button type="button" onClick={() => { if (swipedRef.current) { swipedRef.current = false; return } navigate(`/programs/${featured.id}`) }} className="w-full text-left text-[14px]">
              <div className="flex gap-3">
                <ProgramCover
                  imagePath={featured.cover_image_path}
                  categories={featured.categories}
                  name={featured.name}
                  variant="thumb"
                  className="w-[134px] h-[89px] aspect-auto rounded-xl flex-shrink-0"
                />
                <div className="flex-1 min-w-0 flex flex-col gap-[15px]">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-800 truncate leading-tight">{featured.name}</h3>
                    <span className={`inline-flex items-center justify-center w-[33px] h-[16px] rounded-[3px] text-[9px] font-bold flex-shrink-0 ${fUrgency?.urgency === 'ended' ? 'bg-gray-200 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>
                      {fUrgency?.urgency === 'ended' ? '종료' : '진행중'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-tight flex items-center gap-1">
                    <Calendar className="w-3 h-3 flex-shrink-0 text-gray-400" />
                    기간 {formatKoreanDate(featured.start_date)} ~ {formatKoreanDate(featured.end_date)}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 flex-shrink-0">진행률</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div className={`h-full rounded-full ${fUrgency?.barCls || 'bg-emerald-400'}`}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${fProgress}%` }}
                        viewport={{ once: true, margin: '0px 0px -12% 0px' }}
                        transition={{ duration: 0.9, ease: 'easeOut', delay: 0.3 }}
                      />
                    </div>
                    <span className={`text-sm font-bold flex-shrink-0 ${fUrgency?.textCls || 'text-emerald-600'}`}>{fProgress}%</span>
                  </div>
                </div>
              </div>
              {/* 구분선 (w356) */}
              <div className="h-px w-[356px] max-w-full bg-gray-100 mx-auto mt-3" />
              {/* 4지표 — 선과 6px 간격, 아이콘 + 회색 세로 구분선 */}
              <div className="flex mt-[6px]">
                {fStats.map((s, i) => {
                  const Icon = s.icon
                  return (
                    <div key={s.label} className={`flex-1 text-center px-1 ${i > 0 ? 'border-l border-gray-200' : ''}`}>
                      <div className="flex items-center justify-center gap-1 text-[11px] text-gray-500">
                        <Icon className="w-3 h-3 text-gray-400" />
                        <span className="break-keep">{s.label}</span>
                      </div>
                      <p className="font-bold leading-tight mt-[-5px]">
                        <span className={`text-[12px] ${s.color}`}>{s.num}</span>
                        {s.unit && <span className="text-[10px] text-gray-500">{s.unit}</span>}
                      </p>
                    </div>
                  )
                })}
              </div>
            </button>
          )}
          </ModeSlide>
        </SectionCard>

        {/* ─── 오늘의 활동 요약 — 세로 구분선 + 상태바 ─── */}
        <SectionCard
          title="오늘의 활동 요약"
          action={
            <button type="button" onClick={() => navigate('/profile/activity')} className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700">
              자세히 보기<ChevronRight className="w-3 h-3" />
            </button>
          }
        >
          <ModeSlide mode={effectiveMode} dir={modeDir}>
          <div className="flex">
            {todayMetrics.map((m, i) => {
              const fill = Math.min(100, Math.round((m.value / m.cap) * 100))
              return (
                <div key={m.label} className={`flex-1 flex flex-col items-center text-center px-2 ${i > 0 ? 'border-l border-gray-200' : ''}`}>
                  {/* PNG마다 연한 색 원 크기가 달라(미션·기록은 작음) 클립 안쪽에 회색 링이 남음.
                      확대 비율을 키워 색 원이 원형 클립을 꽉 채우도록 통일 */}
                  <div className={`w-9 h-9 mb-1.5 rounded-full overflow-hidden flex items-center justify-center ${m.circleBg || ''}`}>
                    <img
                      src={m.img}
                      alt=""
                      aria-hidden="true"
                      onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                      style={m.circleBg ? undefined : { transform: `scale(${m.scale ?? 1.4})` }}
                      className={m.circleBg ? 'w-[83%] h-[83%] object-contain' : 'w-full h-full object-cover'}
                    />
                  </div>
                  <p className="text-lg font-extrabold text-gray-900 leading-tight"><CountUp value={m.value} duration={1100} /></p>
                  <p className="text-[11px] text-gray-500 mt-0.5 mb-1.5 break-keep">{m.label}</p>
                  <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div className={`h-full rounded-full ${m.bar}`}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${fill}%` }}
                      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
                      transition={{ duration: 1.0, ease: 'easeOut', delay: 0.25 + i * 0.18 }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          </ModeSlide>
        </SectionCard>

        {/* ─── 내 점수 및 랭킹 ─── */}
        <SectionCard
          title="내 점수 및 랭킹"
          action={
            <button type="button" onClick={() => navigate('/rankings')} className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700">
              전체 랭킹<ChevronRight className="w-3 h-3" />
            </button>
          }
        >
          <ModeSlide mode={effectiveMode} dir={modeDir}>
          <div className="flex items-center justify-around gap-3">
            <div className="text-center">
              <p className="text-[11px] text-emerald-600 font-semibold mb-0.5">총 점수</p>
              <p className="text-xl font-extrabold text-gray-900 leading-tight">
<CountUp value={pStats?.totalPoints ?? 0} duration={1100} /><span className="text-sm text-gray-500 font-bold"> P</span>
              </p>
              {pStats?.weekPoints > 0 && (
                <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">이번주 ↑{pStats.weekPoints}P</p>
              )}
            </div>
            <RankRing rank={featuredRank?.current_rank} total={featuredParticipants} />
          </div>
          </ModeSlide>
        </SectionCard>
        </div>
        </>)}

        {/* 모달 — 둘러보기 + 공개 프로그램 상세 */}
        <ProgramBrowseModal
          isOpen={browseOpen}
          onClose={() => setBrowseOpen(false)}
          programs={publicPrograms}
          onSelect={(id) => { setBrowseOpen(false); setSelectedPublicId(id) }}
        />
        {(() => {
          const idx = selectedPublicId ? publicPrograms.findIndex(p => p.id === selectedPublicId) : -1
          const current = idx >= 0 ? publicPrograms[idx] : null
          const goTo = (i) => setSelectedPublicId(publicPrograms[i].id)
          return (
            <ProgramDetailModal
              program={current}
              isOpen={current !== null}
              onClose={() => setSelectedPublicId(null)}
              onPrev={idx > 0 ? () => goTo(idx - 1) : undefined}
              onNext={idx >= 0 && idx < publicPrograms.length - 1 ? () => goTo(idx + 1) : undefined}
            />
          )
        })()}

        <WelcomeOperatorModal isOpen={showWelcome} onClose={() => setShowWelcome(false)} />
      </div>
    </div>
  )
}

export default DashboardPage
