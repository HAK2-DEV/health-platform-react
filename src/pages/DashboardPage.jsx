import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../supabaseClient'
import { Plus, Activity, Trash2, ChevronRight, ClipboardList, Target, Clock, Trophy, Bell, Users, Calendar, Pencil } from 'lucide-react'
import { formatKoreanDate, formatTodayKstWithWeekday, checkMissionToday, isUpcomingByStartDate } from '../lib/formatters'
import IconBox from '../components/common/IconBox'
import Badge from '../components/common/Badge'
import { CATEGORY } from '../lib/constants'
import ProgramDetailModal from '../components/program/ProgramDetailModal'
import DeleteProgramConfirmModal from '../components/program/DeleteProgramConfirmModal'
import EmptyState from '../components/common/EmptyState'
import LoadingState from '../components/common/LoadingState'
import ProgramCover from '../components/common/ProgramCover'
import { CATEGORY_COLORS, calcProgress, progressUrgency } from '../lib/programVisuals'
import {
  queryKeys,
  fetchMyPrograms,
  fetchActivePrograms,
  fetchActiveParticipantCounts,
  fetchTotalPoints,
  fetchTodayMissions,
  fetchTodayCounts,
  fetchUnreadNotificationsCount,
} from '../lib/queries'

// Stagger fade-in 애니메이션 — 카드들이 차례로 등장
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
}
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

function DashboardPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  // selectedSource: { listKey, programId }. Dashboard 의 「내 프로그램」 카드에서만 모달 사용 (listKey='my').
  // 좌우 스와이프로 myPrograms 안에서 prev/next 이동 (Day 65 본인 모바일 UX 요청).
  const [selectedSource, setSelectedSource] = useState(null)
  const [programToDelete, setProgramToDelete] = useState(null)  // PUBLISHED 삭제용 (이중 확인 모달)

  // 로그아웃 시 /login 으로
  useEffect(() => {
    if (session === null) {
      navigate('/login')
    }
  }, [session, navigate])

  // ─── React Query — 모든 데이터는 같은 캐시 키로 공유 ───────────
  // 인증/심사 등 mutation onSuccess 에서 invalidate 호출 시 자동으로 모든 화면 갱신
  const { data: myPrograms = [], isLoading } = useQuery({
    queryKey: queryKeys.myPrograms(userId),
    queryFn: () => fetchMyPrograms(userId),
    enabled: !!userId,
  })

  const { data: activePrograms = [], isLoading: isLoadingActive } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })

  const { data: totalPoints = 0 } = useQuery({
    queryKey: queryKeys.totalPoints(userId),
    queryFn: () => fetchTotalPoints(userId),
    enabled: !!userId,
  })

  // 오늘의 미션 — activePrograms 의 id 들에 의존 (배열 변하면 자동 재조회)
  const activeProgramIds = activePrograms.map(p => p.id)
  const { data: todayMissions = [] } = useQuery({
    queryKey: ['missions', 'today', userId, ...activeProgramIds],
    queryFn: () => fetchTodayMissions(activeProgramIds),
    enabled: !!userId && activeProgramIds.length > 0,
  })

  // 참여 중인 프로그램 카드의 "N명이 함께 참여 중" 표시용 카운트
  const { data: activeCounts = {} } = useQuery({
    queryKey: queryKeys.activeParticipantCounts(activeProgramIds),
    queryFn: () => fetchActiveParticipantCounts(activeProgramIds),
    enabled: activeProgramIds.length > 0,
  })

  const { data: todayCounts = {} } = useQuery({
    queryKey: queryKeys.todayCounts(userId),
    queryFn: () => fetchTodayCounts(userId),
    enabled: !!userId,
  })

  const { data: unreadNotifCount = 0 } = useQuery({
    queryKey: queryKeys.notificationsUnread(userId),
    queryFn: fetchUnreadNotificationsCount,
    enabled: !!userId,
  })

  // 오늘의 미션 그루핑 — 2단계: program_id → (bundle_title or solo)
  //   같은 프로그램의 묶음 미션은 묶음 카드 1장 + 단독 미션은 개별 카드
  //   결과: [{ programId, program, items: [{ kind, bundleTitle, missions }] }]
  const todayMissionsByProgram = useMemo(() => {
    const programMap = new Map()
    for (const m of todayMissions) {
      if (!programMap.has(m.program_id)) {
        programMap.set(m.program_id, {
          programId: m.program_id,
          program: m.programs,
          _itemMap: new Map(),
        })
      }
      const programBucket = programMap.get(m.program_id)
      const itemKey = m.bundle_title ? `bundle__${m.bundle_title}` : `solo__${m.id}`
      if (!programBucket._itemMap.has(itemKey)) {
        programBucket._itemMap.set(itemKey, {
          kind: m.bundle_title ? 'bundle' : 'solo',
          bundleTitle: m.bundle_title || null,
          missions: [],
        })
      }
      programBucket._itemMap.get(itemKey).missions.push(m)
    }
    // Map → Array + _itemMap 정리
    return Array.from(programMap.values()).map(p => ({
      programId: p.programId,
      program: p.program,
      items: Array.from(p._itemMap.values()),
    }))
  }, [todayMissions])

  // 오늘의 미션 전체 보기 토글 — 카드 단위 3개 (프로그램 단위 X)
  // 전체보기 토글 시 해당 섹션 viewport 상단으로 스크롤
  const todayMissionsRef = useRef(null)
  const myProgramsRef = useRef(null)
  const activeProgramsRef = useRef(null)
  const scrollToSection = (ref) => {
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const [showAllTodayMissions, setShowAllTodayMissions] = useState(false)
  // 내 프로그램 / 참여 중인 프로그램 전체보기 토글
  const [showAllMyPrograms, setShowAllMyPrograms] = useState(false)
  const [showAllActivePrograms, setShowAllActivePrograms] = useState(false)
  const totalItemCount = useMemo(
    () => todayMissionsByProgram.reduce((s, p) => s + p.items.length, 0),
    [todayMissionsByProgram]
  )
  // 표시 — 카드 3개까지 누적해서 프로그램별 부분 슬라이스
  const displayedPrograms = useMemo(() => {
    if (showAllTodayMissions) return todayMissionsByProgram
    const result = []
    let remaining = 2
    for (const p of todayMissionsByProgram) {
      if (remaining <= 0) break
      const sliced = p.items.slice(0, remaining)
      result.push({ ...p, items: sliced })
      remaining -= sliced.length
    }
    return result
  }, [todayMissionsByProgram, showAllTodayMissions])

  // 참여 예정 (ACTIVE 참여지만 프로그램 시작 전)
  const upcomingPrograms = activePrograms.filter(p => {
    if (!p.start_date) return false
    return new Date(`${p.start_date}T00:00:00+09:00`) > new Date()
  })
  // 실제 운영 중 = 참여 중 - 시작 전
  const runningCount = activePrograms.length - upcomingPrograms.length

  // 프로그램 삭제 — DRAFT/PUBLISHED 둘 다. CASCADE 로 모든 관련 데이터 사라짐.
  //   DRAFT: 단순 confirm (안전장치 무거움 X)
  //   PUBLISHED: DeleteProgramConfirmModal 이중 확인 (이름 재입력)
  const deleteMutation = useMutation({
    mutationFn: async (programId) => {
      const { error } = await supabase
        .from('programs')
        .delete()
        .eq('id', programId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myPrograms(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.activePrograms(userId) })
      // 점수/랭킹/통계도 사라짐 — 다른 화면에도 반영
      queryClient.invalidateQueries({ queryKey: ['scores'] })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
    onError: (err) => {
      console.error('삭제 실패:', err)
      alert('삭제에 실패했습니다')
    },
  })

  const handleDelete = (program) => {
    if (program.status === 'DRAFT') {
      if (!window.confirm(`"${program.name}" 임시저장을 삭제할까요?`)) return
      deleteMutation.mutate(program.id)
    } else {
      // PUBLISHED 등 — 이중 확인 모달
      setProgramToDelete(program)
    }
  }

  const handleConfirmDeletePublished = async () => {
    if (!programToDelete) return
    await deleteMutation.mutateAsync(programToDelete.id)
    setProgramToDelete(null)
  }

  return (
    <div className="min-h-screen bg-surface-app">
      {/* 상단 풀 너비 그라데이션 풍경 영역 (컴팩트) — pb 축소 (본인 결정 Day 58): CTA 제거 후 빈 공간 줄임 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative bg-gradient-to-b from-emerald-100 via-emerald-50/80 to-teal-50/50 pt-4 pb-20 overflow-hidden"
      >
        <div className="max-w-4xl mx-auto px-4 relative">
          {/* 인사말 한 줄 (App.jsx 헤더 숨김 상태이므로 여기에 표시) */}
          <div className="flex items-start justify-between mb-3">
            <p className="text-[15px] font-medium text-gray-800 pr-4 leading-relaxed pt-1">
              안녕하세요, 오늘도 건강한 하루 되세요! 🌿
            </p>
            <button
              type="button"
              className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-soft flex-shrink-0 hover:shadow-elevated transition"
              title="알림"
              onClick={() => navigate('/notifications')}
            >
              <Bell className="w-4 h-4 text-gray-600" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white shadow-md">
                  {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                </span>
              )}
            </button>
          </div>

          {/* Health-Platform 로고 + 오늘 날짜 (참고 사진 헤더) */}
          <div className="flex items-center gap-1.5">
            <span className="text-2xl">🌿</span>
            <span className="text-2xl font-bold text-brand-primary">Health-Platform</span>
          </div>
          <p className="text-sm font-medium text-gray-600 mt-1.5 ml-0.5">
            {formatTodayKstWithWeekday()}
          </p>
        </div>

        {/* 마스코트 일러스트 — 작게, 우측 */}
        <div className="absolute top-6 right-0 left-0 pointer-events-none select-none">
          <div className="max-w-4xl mx-auto px-4 relative">
            <div className="absolute right-4 top-0 w-24 h-24 sm:w-28 sm:h-28">
              <span className="absolute inset-0 flex items-center justify-center text-5xl opacity-25">
                🌱
              </span>
              <img
                src="/illustrations/mascot.png"
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Day 65 Phase 1.3 — 큰 흰 카드 제거, 각 섹션을 독립 흰 카드로 분리.
          페이지 bg(연한 mint)가 보이면서 각 섹션이 떠 있는 듯 시각 분리. */}
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 -mt-16 relative space-y-4 pb-6">

      {/* CTA 제거 (본인 결정 Day 58) — 일일 사용 페이지로 깔끔하게.
          프로그램 생성은 BottomTab 「프로그램」 → FAB(+) 으로 일원화. */}

      {/* 통계 4개 카드 — Day 65 Phase 1.1 (참고 사진): outer wrapper 박스로 4 통계를 묶음.
          가로 폭 최대 확보 (px-2 + 음수 마진 -mx-1) + gap 축소로 라벨 truncation 방지. */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="bg-white border border-gray-100 rounded-card-lg px-3 py-3 shadow-soft"
      >
        <div className="grid grid-cols-4 gap-2">
          <StatCard
            tone="emerald"
            icon={<ClipboardList className="w-5 h-5" />}
            label="내 프로그램"
            value={myPrograms.length}
            unit="개"
          />
          <StatCard
            tone="sky"
            icon={<Target className="w-5 h-5" />}
            label="참여 중"
            value={runningCount}
            unit="개"
          />
          <StatCard
            tone="amber"
            icon={<Clock className="w-5 h-5" />}
            label="참여 예정"
            value={upcomingPrograms.length}
            unit="개"
          />
          <StatCard
            tone="violet"
            icon={<Trophy className="w-5 h-5" />}
            label="누적 포인트"
            value={totalPoints}
            unit="P"
          />
        </div>
      </motion.section>

      {/* 참여 중인 프로그램 — Day 65 본인 결정: 오늘의 미션 위로 이동 (메인 흐름 우선) */}
      <section ref={activeProgramsRef} className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-4 scroll-mt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            🎯 참여 중인 프로그램
          </h2>
          {activePrograms.length > 2 && (
            <button
              type="button"
              onClick={() => { setShowAllActivePrograms(!showAllActivePrograms); scrollToSection(activeProgramsRef) }}
              className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700"
            >
              {showAllActivePrograms ? '간단히 보기' : `전체보기 (${activePrograms.length})`}
              {!showAllActivePrograms && <ChevronRight className="w-3 h-3" />}
            </button>
          )}
        </div>

        {isLoadingActive ? (
          <LoadingState />
        ) : activePrograms.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="참여 중인 프로그램이 없어요"
            description="새로운 건강 프로그램에 참여해보세요"
            variant="mint"
            size="lg"
            action={{ label: '프로그램 둘러보기', onClick: () => navigate('/programs') }}
          />
        ) : (
          // Day 65 Phase 1.2 — 참고 사진 카드 양식:
          // 카테고리 틴팅 + 진행중 뱃지 오버레이 + 굵은 제목 + 진행률 바 강조 + % 우측 큰 텍스트
          <motion.div className="grid grid-cols-1 gap-3">
            <AnimatePresence initial={false}>
            {(showAllActivePrograms ? activePrograms : activePrograms.slice(0, 2)).map(program => {
              const catKey = program.categories?.[0] || 'ETC'
              const catColors = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.ETC
              const progress = calcProgress(program.start_date, program.end_date)
              const urgency = progressUrgency(progress)
              const isEnded = urgency.urgency === 'ended'
              const isUpcoming = !isEnded && isUpcomingByStartDate(program.start_date)  // 예약(시작 전) 참여
              // 종료된 프로그램은 회색 카드 — 시각적으로 「현재 활성 ≠ 종료」 구분
              const colors = isEnded
                ? { bg: 'bg-gray-100', border: 'border-gray-200', accent: 'bg-gray-400' }
                : catColors
              const barAccentCls = urgency.barCls || colors.accent
              // 카테고리별 % 텍스트 컬러 — 카드 톤과 일관성
              const catPercentCls = catKey === 'MINDCARE' ? 'text-orange-600'
                : catKey === 'EMPATHY' ? 'text-pink-600'
                : catKey === 'SLEEP' ? 'text-purple-600'
                : catKey === 'NO_SMOKING' ? 'text-yellow-600'
                : catKey === 'ETC' ? 'text-gray-600'
                : 'text-emerald-600'
              const percentTextCls = urgency.textCls || catPercentCls
              // 참여자 수 pill — 카드 배경보다 한 단계 진한 톤 (참고 사진)
              const countPillCls = catKey === 'MINDCARE' ? 'bg-orange-100/80 text-orange-700'
                : catKey === 'EMPATHY' ? 'bg-pink-100/80 text-pink-700'
                : catKey === 'SLEEP' ? 'bg-purple-100/80 text-purple-700'
                : catKey === 'NO_SMOKING' ? 'bg-yellow-100/80 text-yellow-700'
                : catKey === 'ETC' ? 'bg-gray-100/80 text-gray-700'
                : 'bg-emerald-100/80 text-emerald-700'

              return (
                <motion.div
                  key={program.id}
                  onClick={() => navigate(`/programs/${program.id}`)}
                  className={`${colors.bg} ${colors.border} border rounded-card p-3 shadow-soft hover:shadow-elevated transition cursor-pointer flex items-center gap-3`}
                >
                  {/* 표지 사진 + 진행중 뱃지 오버레이 */}
                  <div className="relative flex-shrink-0">
                    <ProgramCover
                      imagePath={program.cover_image_path}
                      categories={program.categories}
                      name={program.name}
                      variant="thumb"
                      className="w-20 h-20 rounded-card"
                    />
                    <Badge variant={isEnded ? 'ended' : isUpcoming ? 'upcoming' : 'progress'} size="sm" className="absolute top-1.5 left-1.5 shadow-sm">
                      {isEnded ? '종료' : isUpcoming ? '예정' : '진행중'}
                    </Badge>
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base text-gray-800 truncate">{program.name}</h3>
                    {program.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{program.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-2 bg-white/90 rounded-full overflow-hidden">
                        <div
                          className={`${barAccentCls} h-full rounded-full transition-all`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className={`text-base font-bold flex-shrink-0 ${percentTextCls}`}>{progress}%</span>
                    </div>
                    {urgency.label && (
                      <p className={`text-[11px] font-medium mt-1 ${percentTextCls}`}>
                        {urgency.urgency === 'ended' ? '🏁' : urgency.urgency === 'imminent' ? '🔥' : '⏳'} {urgency.label}
                      </p>
                    )}
                    {/* 참여자 수 pill — 카드 배경 카테고리와 같은 톤 (참고 사진) */}
                    {activeCounts[program.id] != null && (
                      <div className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-pill text-[11px] font-medium w-fit ${countPillCls}`}>
                        <Users className="w-3 h-3 flex-shrink-0" />
                        <span>{activeCounts[program.id].toLocaleString()}명이 함께 참여 중</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* 오늘의 미션 — 프로그램별 그루핑 (3개까지만, 전체보기 토글) */}
      <section ref={todayMissionsRef} className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-4 scroll-mt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            ✨ 오늘의 미션
          </h2>
          {totalItemCount > 2 && (
            <button
              type="button"
              onClick={() => { setShowAllTodayMissions(!showAllTodayMissions); scrollToSection(todayMissionsRef) }}
              className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700"
            >
              {showAllTodayMissions ? '간단히 보기' : `전체보기 (${totalItemCount})`}
              {!showAllTodayMissions && <ChevronRight className="w-3 h-3" />}
            </button>
          )}
        </div>

        {todayMissions.length === 0 ? (
          /* 컴팩트 빈 상태 — DashboardPage 전용 인라인 (Day 65 본인 결정).
             공용 EmptyState 보다 작은 사이즈 + description 한 줄 강제 (글자 자동 축소).
             둘러보기 버튼은 의도적으로 제외 — 참여 중인 프로그램 박스에 이미 있음. */
          <div className="bg-gray-50/60 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="text-2xl opacity-70 leading-none flex-shrink-0">✨</div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium text-gray-800 leading-tight">오늘 인증할 미션이 없어요</p>
              <p className="text-xs text-gray-500 mt-1 break-keep leading-relaxed">
                참여 중인 프로그램이 시작되면 표시돼요
              </p>
            </div>
          </div>
        ) : (
          <motion.div className="space-y-3">
            <AnimatePresence initial={false}>
            {displayedPrograms.map(programBucket => {
              const catKey = programBucket.program?.categories?.[0] || 'ETC'
              const cat = CATEGORY[catKey] || CATEGORY.ETC
              const colors = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.ETC

              return (
                <motion.div
                  key={programBucket.programId}
                >
                  {/* 프로그램 헤더 — 배경 칩으로 시각 분리 */}
                  <div className="flex items-center mb-2.5">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-pill truncate max-w-full">
                      <span>{cat.emoji}</span>
                      <span className="truncate">{programBucket.program?.name}</span>
                    </span>
                  </div>

                  {/* Day 65 Phase 1.3 — 미션 카드 양식:
                      큰 IconBox(w-14) + 굵은 제목 + 그린 +N P 강조 + ChevronRight */}
                  <div className="grid gap-2">
                    {programBucket.items.map(item => {
                      // ─── 묶음 카드 ───
                      if (item.kind === 'bundle') {
                        const totalPoint = item.missions.reduce((s, m) => s + (m.point || 0), 0)
                        const bundleParam = encodeURIComponent(item.bundleTitle)
                        const allCompleted = item.missions.every(m => {
                          const todayCount = todayCounts[m.id]?.total || 0
                          const pendingCount = todayCounts[m.id]?.pending || 0
                          const limit = m.daily_limit
                          return limit != null && todayCount >= limit && pendingCount === 0
                        })

                        return (
                          <motion.button
                            key={`bundle:${programBucket.programId}:${item.bundleTitle}`}
                            type="button"
                            variants={itemVariants}
                            onClick={() => navigate(`/programs/${programBucket.programId}/bundles/${bundleParam}`)}
                            className={`${colors.bg} ${colors.border} border rounded-2xl p-3 flex items-center gap-3 text-left hover:brightness-95 transition`}
                          >
                            <div className="w-14 h-14 flex-shrink-0 bg-white/80 rounded-xl relative overflow-hidden">
                              <span className="absolute inset-0 flex items-center justify-center text-3xl">
                                {cat.emoji}
                              </span>
                              <img
                                src={`/illustrations/categories/${cat.key}.png`}
                                alt=""
                                className="absolute inset-0 w-full h-full object-contain"
                                onError={(e) => { e.currentTarget.style.display = 'none' }}
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-800 truncate text-base leading-tight">
                                {item.bundleTitle}
                              </h3>
                              <p className="text-xs text-gray-500 mt-1">
                                {item.missions.length}개 미션 · 총 <span className="text-emerald-600 font-semibold">+{totalPoint}P</span>
                              </p>
                            </div>

                            {allCompleted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-600 text-xs rounded-pill font-medium whitespace-nowrap flex-shrink-0">
                                ✓ 완료
                              </span>
                            ) : (
                              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            )}
                          </motion.button>
                        )
                      }

                      // ─── 단독 미션 카드 ───
                      const mission = item.missions[0]
                      const types = []
                      if (mission.requires_image) types.push('업로드')
                      if (mission.requires_numeric) types.push('기록')
                      if (mission.requires_note) types.push('소감')
                      const isSupported = types.length > 0
                      const buttonLabel = types.length === 1 ? types[0] : (isSupported ? '인증' : null)

                      const todayCount = todayCounts[mission.id]?.total || 0
                      const pendingCount = todayCounts[mission.id]?.pending || 0
                      const limit = mission.daily_limit
                      const reachedLimit = limit != null && todayCount >= limit
                      const hasPending = pendingCount > 0
                      const todayCheck = checkMissionToday(mission)

                      return (
                        <motion.div
                          key={mission.id}
                          variants={itemVariants}
                          className={`${colors.bg} ${colors.border} border rounded-2xl p-3 flex items-center gap-3`}
                        >
                          <div className="w-14 h-14 flex-shrink-0 bg-white/80 rounded-xl relative overflow-hidden">
                            <span className="absolute inset-0 flex items-center justify-center text-3xl">
                              {cat.emoji}
                            </span>
                            <img
                              src={`/illustrations/categories/${cat.key}.png`}
                              alt=""
                              className="absolute inset-0 w-full h-full object-contain"
                              onError={(e) => { e.currentTarget.style.display = 'none' }}
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-800 truncate text-base leading-tight">
                              {mission.title}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                              <span className="text-emerald-600 font-semibold">+{mission.point}P</span>
                            </p>
                          </div>

                          {!isSupported ? (
                            <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                              준비 중
                            </span>
                          ) : !todayCheck.active ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-500 text-xs rounded-full font-medium whitespace-nowrap flex-shrink-0">
                              🚫 {todayCheck.reason}
                            </span>
                          ) : reachedLimit ? (
                            hasPending ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 text-xs rounded-full font-medium whitespace-nowrap flex-shrink-0">
                                ⏳ 심사 대기
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-600 text-xs rounded-full font-medium whitespace-nowrap flex-shrink-0">
                                ✓ 완료
                              </span>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigate(`/programs/${mission.program_id}/missions/${mission.id}`)}
                              className="px-3 py-1.5 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-xs rounded-full transition whitespace-nowrap flex-shrink-0 font-medium"
                            >
                              {buttonLabel}
                            </button>
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>
              )
            })}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* 내가 만든 프로그램 — 최대 3개 요약 (전체는 /programs) */}
      <section ref={myProgramsRef} className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-4 scroll-mt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <Activity className="w-5 h-5 text-emerald-500" />
            내 프로그램
          </h2>
          <div className="flex items-center gap-2">
            {myPrograms.length > 2 && (
              <button
                type="button"
                onClick={() => { setShowAllMyPrograms(!showAllMyPrograms); scrollToSection(myProgramsRef) }}
                className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700"
              >
                {showAllMyPrograms ? '간단히 보기' : `전체보기 (${myPrograms.length})`}
                {!showAllMyPrograms && <ChevronRight className="w-3 h-3" />}
              </button>
            )}
            {/* 상단 "+ 프로그램 생성하기" CTA 가 있으므로 1개 이상일 때는 중복 제거.
                0개일 때만 빈 상태 옆 보조 CTA 로 노출 */}
            {myPrograms.length === 0 && (
              <Link
                to="/programs/new"
                className="flex items-center gap-1 px-3 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm rounded-md transition"
              >
                <Plus className="w-4 h-4" />
                새 프로그램
              </Link>
            )}
          </div>
        </div>

        {isLoading ? (
          <LoadingState />
        ) : myPrograms.length === 0 ? (
          <EmptyState
            icon="📋"
            title="아직 만든 프로그램이 없어요"
            description="위의 '프로그램 생성하기' 버튼으로 시작해보세요"
          />
        ) : (
          // Day 65 Phase 1.4 — 내 프로그램 카드 양식:
          // Badge 프리미티브 + 굵기 위계 정돈 + Calendar 아이콘 + Trash 컬러 차분.
          <motion.div className="grid grid-cols-1 gap-3">
            <AnimatePresence initial={false}>
            {(showAllMyPrograms ? myPrograms : myPrograms.slice(0, 2)).map(program => {
              const isDraft = program.status === 'DRAFT'
              const isUpcoming = !isDraft && isUpcomingByStartDate(program.start_date)
              const badgeVariant = isDraft ? 'draft' : isUpcoming ? 'upcoming' : 'progress'
              const statusLabel = isDraft ? '임시저장' : isUpcoming ? '예정' : '진행중'
              return (
                <motion.div
                  key={program.id}
                  onClick={() => {
                    if (isDraft) {
                      navigate(`/programs/new?id=${program.id}`)
                    } else {
                      setSelectedSource({ listKey: 'my', programId: program.id })
                    }
                  }}
                  className="bg-white border border-gray-100 rounded-card p-3 shadow-soft hover:shadow-elevated transition cursor-pointer"
                >
                  <div className="flex gap-3 items-start">
                    <ProgramCover
                      imagePath={program.cover_image_path}
                      categories={program.categories}
                      name={program.name}
                      variant="thumb"
                      className="w-16 h-16 rounded-xl"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-gray-800 truncate">{program.name}</h3>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Badge variant={badgeVariant} size="sm">{statusLabel}</Badge>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(program)
                            }}
                            disabled={deleteMutation.isPending}
                            className="p-1 text-gray-300 hover:text-red-500 transition disabled:opacity-40"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {program.description && program.description.trim() !== program.name?.trim() && (
                        <p className="text-xs text-gray-500 mb-1 line-clamp-1">
                          {program.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3 flex-shrink-0 text-gray-400" />
                        <span>{formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}</span>
                      </p>
                      {isDraft && (
                        <p className="text-[11px] text-emerald-600 mt-1.5 flex items-center gap-1">
                          <Pencil className="w-3 h-3 flex-shrink-0" />
                          <span>클릭하면 이어서 작성할 수 있어요</span>
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* 공개 둘러보기 섹션은 BottomTabBar 📋 프로그램 탭에 통합 — 중복 제거 */}

        {/* 프로그램 상세 모달 — 좌우 스와이프로 myPrograms 안에서 prev/next */}
        {(() => {
          const currentIndex = selectedSource
            ? myPrograms.findIndex(p => p.id === selectedSource.programId)
            : -1
          const currentProgram = currentIndex >= 0 ? myPrograms[currentIndex] : null
          const goTo = (idx) => setSelectedSource({ listKey: 'my', programId: myPrograms[idx].id })
          return (
            <ProgramDetailModal
              program={currentProgram}
              isOpen={currentProgram !== null}
              onClose={() => setSelectedSource(null)}
              onPrev={currentIndex > 0 ? () => goTo(currentIndex - 1) : undefined}
              onNext={currentIndex >= 0 && currentIndex < myPrograms.length - 1 ? () => goTo(currentIndex + 1) : undefined}
            />
          )
        })()}

        {/* PUBLISHED 프로그램 삭제 — 이름 재입력 확인 */}
        <DeleteProgramConfirmModal
          program={programToDelete}
          isOpen={programToDelete !== null}
          onClose={() => setProgramToDelete(null)}
          onConfirm={handleConfirmDeletePublished}
        />

      </div>
    </div>
  )
}

// 통계 카드 — IconBox + 라벨 + 숫자 + 단위 (참고 사진 패턴)
// Day 65 Phase 1.1.
// 패딩 최소화 + clamp() 폰트로 라벨 자동 축소 — 「랭킹 포인트」 같이 긴 라벨도 ... 없이 표시.
function StatCard({ tone, icon, label, value, unit }) {
  return (
    <motion.div
      variants={itemVariants}
      className="bg-white border border-gray-100 rounded-card px-1.5 py-2.5 min-w-0 shadow-soft flex flex-col items-center text-center"
    >
      <IconBox tone={tone} size="md" shape="circle" className="mb-1.5">
        {icon}
      </IconBox>
      <p
        className="text-gray-500 whitespace-nowrap w-full font-medium leading-tight"
        style={{ fontSize: 'clamp(9px, 2.6vw, 11px)' }}
      >
        {label}
      </p>
      <p className="leading-tight whitespace-nowrap w-full mt-0.5">
        <span className="text-2xl font-bold text-gray-800">{value}</span>
        <span className="text-xs text-gray-500 ml-0.5">{unit}</span>
      </p>
    </motion.div>
  )
}

export default DashboardPage
