import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { Bell, ChevronRight, Calendar } from 'lucide-react'
import { supabase } from '../supabaseClient'
import ProgramDetailModal from '../components/program/ProgramDetailModal'
import ProgramBrowseModal from '../components/program/ProgramBrowseModal'
import WelcomeOperatorModal from '../components/program/WelcomeOperatorModal'
import ProgramCover from '../components/common/ProgramCover'
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

// 섹션 카드 — 모서리 10px, 제목 + 우측 액션
function SectionCard({ title, action, children, className = '' }) {
  return (
    <section className={`bg-white border border-gray-100 rounded-[10px] shadow-soft p-4 ${className}`}>
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

// 내 랭킹 도넛 링
function RankRing({ rank, total }) {
  const R = 30
  const C = 2 * Math.PI * R
  const pct = (rank && total) ? Math.max(0.04, Math.min(1, (total - rank + 1) / total)) : 0
  return (
    <div className="relative w-[84px] h-[84px]">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={R} fill="none" stroke="#e5e7eb" strokeWidth="7" />
        <circle cx="40" cy="40" r={R} fill="none" stroke="#10b981" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] text-emerald-600 font-semibold leading-none">내 랭킹</span>
        <span className="text-lg font-extrabold text-gray-900 leading-tight">{rank ? `${rank}등` : '-'}</span>
        <span className="text-[10px] text-gray-400 leading-none">/ {total || '-'}명</span>
      </div>
    </div>
  )
}

function DashboardPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const userId = session?.user?.id

  const [selectedPublicId, setSelectedPublicId] = useState(null)
  const [browseOpen, setBrowseOpen] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)

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

  const { data: myPrograms = [] } = useQuery({
    queryKey: queryKeys.myPrograms(userId),
    queryFn: () => fetchMyPrograms(userId),
    enabled: !!userId,
  })

  const { data: activePrograms = [], isLoading: isActiveLoading } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })

  const activeProgramIds = activePrograms.map(p => p.id)
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

  const featured = activePrograms[0] || null
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

  // ─── 파생 ─────────
  const isOperator = myPrograms.length > 0

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

  // 참여 중 프로그램 4지표 (숫자 12px / 단위 9px / 색상은 지표별)
  const fStats = [
    { icon: UsersSolid, label: '참여자', num: featuredParticipants != null ? `${featuredParticipants}` : '-', unit: featuredParticipants != null ? '명' : '', color: 'text-emerald-600' },
    { icon: TrophySolid, label: '내 순위', num: featuredRank?.current_rank ? `${featuredRank.current_rank}` : '-', unit: featuredRank?.current_rank ? '등' : '', color: 'text-gray-900' },
    { icon: CalendarSolid, label: '남은 기간', num: daysLeft != null ? `${daysLeft}` : '상시', unit: daysLeft != null ? '일' : '', color: 'text-gray-900' },
    { icon: FlagSolid, label: '내 목표 달성률', num: achieveRate != null ? `${achieveRate}` : '-', unit: achieveRate != null ? '%' : '', color: 'text-emerald-600' },
  ]

  // 오늘의 활동 (값 / 소프트 캡 → 막대 비율)
  const todayMetrics = [
    { label: '미션 완료', value: today?.missionCount ?? 0, cap: 8, img: '/icons/activity/mission.png', bar: 'bg-emerald-500' },
    { label: '기록 작성', value: today?.recordCount ?? 0, cap: 5, img: '/icons/activity/record.png', bar: 'bg-blue-500' },
    { label: '댓글 활동', value: today?.commentCount ?? 0, cap: 10, img: '/icons/activity/comment.png', bar: 'bg-amber-500' },
    { label: '획득 점수', value: today?.points ?? 0, cap: 300, img: '/icons/activity/points.png', bar: 'bg-purple-500' },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* ─── 상단 헤더 (도담 + 알림) — 모서리 0, 최상단 고정 톤 ─── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
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

        {/* ─── 인사말 헤더 (이미지 카드, 모서리 10) ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-[10px] bg-gradient-to-r from-emerald-100 to-teal-50 min-h-[109px]"
        >
          <img
            src="/home-header.png"
            alt=""
            aria-hidden="true"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
            className="absolute inset-0 w-full h-full object-cover object-[center_30%] opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/85 via-white/55 to-transparent" />
          <div className="relative p-4">
            <p className="text-[13px] font-medium text-gray-700 leading-tight drop-shadow-sm">
              오늘도 건강한 하루 되세요! 👋
            </p>
            <p className="mt-0.5 text-2xl font-extrabold text-gray-900 leading-tight drop-shadow-sm">
              {nickname ? `${nickname}님` : '반가워요'}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold">
                {isOperator ? '운영자' : 'Lv.1'}
              </span>
              <span className="text-[12px] font-medium text-gray-700">건강한 습관이 쌓이고 있어요!</span>
            </div>
          </div>
        </motion.div>

        {/* ─── 참여 중인 프로그램 (대표 1개) ─── */}
        <SectionCard
          title="참여 중인 프로그램"
          action={activePrograms.length > 0 && (
            <button type="button" onClick={() => navigate('/programs')} className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700">
              전체 보기 {activePrograms.length > 1 && `(${activePrograms.length})`}<ChevronRight className="w-3 h-3" />
            </button>
          )}
        >
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
            <button type="button" onClick={() => navigate(`/programs/${featured.id}`)} className="w-full text-left text-[14px]">
              <div className="flex gap-3">
                <ProgramCover
                  imagePath={featured.cover_image_path}
                  categories={featured.categories}
                  name={featured.name}
                  variant="thumb"
                  className="w-[137px] h-[89px] aspect-auto rounded-xl flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-800 truncate">{featured.name}</h3>
                    <span className={`inline-flex items-center justify-center w-[33px] h-[16px] rounded-[3px] text-[9px] font-bold flex-shrink-0 ${fUrgency?.urgency === 'ended' ? 'bg-gray-200 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>
                      {fUrgency?.urgency === 'ended' ? '종료' : '진행중'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-[4px] flex items-center gap-1">
                    <Calendar className="w-3 h-3 flex-shrink-0 text-gray-400" />
                    기간 {formatKoreanDate(featured.start_date)} ~ {formatKoreanDate(featured.end_date)}
                  </p>
                  <div className="flex items-center gap-2 mt-[3px]">
                    <span className="text-xs text-gray-500 flex-shrink-0">진행률</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${fUrgency?.barCls || 'bg-emerald-400'}`} style={{ width: `${fProgress}%` }} />
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
                      <div className="flex items-center justify-center gap-1 text-[9px] text-gray-500">
                        <Icon className="w-3 h-3 text-gray-400" />
                        <span className="break-keep">{s.label}</span>
                      </div>
                      <p className="font-bold leading-tight mt-[-5px]">
                        <span className={`text-[12px] ${s.color}`}>{s.num}</span>
                        {s.unit && <span className="text-[9px] text-gray-500">{s.unit}</span>}
                      </p>
                    </div>
                  )
                })}
              </div>
            </button>
          )}
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
          <div className="flex">
            {todayMetrics.map((m, i) => {
              const fill = Math.min(100, Math.round((m.value / m.cap) * 100))
              return (
                <div key={m.label} className={`flex-1 flex flex-col items-center text-center px-2 ${i > 0 ? 'border-l border-gray-200' : ''}`}>
                  {/* 아이콘 PNG에 투명 채널이 없어(회색 체크무늬 구워짐) 원형으로 클립 + 살짝 확대해 회색 모서리 제거 */}
                  <div className="w-9 h-9 mb-1.5 rounded-full overflow-hidden">
                    <img
                      src={m.img}
                      alt=""
                      aria-hidden="true"
                      onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                      className="w-full h-full object-cover scale-[1.12]"
                    />
                  </div>
                  <p className="text-lg font-extrabold text-gray-900 leading-tight">{m.value}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 mb-1.5 break-keep">{m.label}</p>
                  <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${fill}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
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
          <div className="flex items-center justify-around gap-3">
            <div className="text-center">
              <p className="text-[11px] text-emerald-600 font-semibold mb-0.5">총 점수</p>
              <p className="text-xl font-extrabold text-gray-900 leading-tight">
                {(pStats?.totalPoints ?? 0).toLocaleString()}<span className="text-sm text-gray-500 font-bold"> P</span>
              </p>
              {pStats?.weekPoints > 0 && (
                <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">이번주 ↑{pStats.weekPoints}P</p>
              )}
            </div>
            <RankRing rank={featuredRank?.current_rank} total={featuredParticipants} />
          </div>
        </SectionCard>

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
