import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../supabaseClient'
import { Plus, Activity, Trash2, ChevronRight, ClipboardList, Target, Clock, Trophy, Bell } from 'lucide-react'
import { formatKoreanDate, checkMissionToday, isUpcomingByStartDate } from '../lib/formatters'
import { CATEGORY } from '../lib/constants'
import ProgramDetailModal from '../components/program/ProgramDetailModal'
import DeleteProgramConfirmModal from '../components/program/DeleteProgramConfirmModal'
import EmptyState from '../components/common/EmptyState'
import LoadingState from '../components/common/LoadingState'
import ProgramCover from '../components/common/ProgramCover'
import {
  queryKeys,
  fetchMyPrograms,
  fetchActivePrograms,
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

// 카테고리별 파스텔 색상 매핑 (Tailwind JIT 안전 — 명시적 클래스명)
const CATEGORY_COLORS = {
  WALKING:    { bg: 'bg-emerald-50', border: 'border-emerald-100', accent: 'bg-emerald-400' },
  DIET:       { bg: 'bg-emerald-50',   border: 'border-emerald-100',   accent: 'bg-emerald-400' },
  EMPATHY:    { bg: 'bg-pink-50',    border: 'border-pink-100',    accent: 'bg-pink-400' },
  MINDCARE:   { bg: 'bg-orange-50',  border: 'border-orange-100',  accent: 'bg-orange-400' },
  SLEEP:      { bg: 'bg-purple-50',  border: 'border-purple-100',  accent: 'bg-purple-400' },
  NO_SMOKING: { bg: 'bg-yellow-50',  border: 'border-yellow-100',  accent: 'bg-yellow-400' },
  ETC:        { bg: 'bg-gray-50',    border: 'border-gray-100',    accent: 'bg-gray-400' },
}

// 시간 기반 진행률 (KST)
const calcProgress = (startDate, endDate) => {
  if (!startDate || !endDate) return 0
  const now = new Date()
  const start = new Date(`${startDate}T00:00:00+09:00`)
  const end = new Date(`${endDate}T23:59:59+09:00`)
  if (now < start) return 0
  if (now > end) return 100
  const total = end - start
  const passed = now - start
  return Math.round((passed / total) * 100)
}


function DashboardPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const [selectedProgram, setSelectedProgram] = useState(null)
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
    <div className="min-h-screen">
      {/* 상단 풀 너비 그라데이션 풍경 영역 (컴팩트) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative bg-gradient-to-b from-emerald-100 via-emerald-50/80 to-teal-50/50 pt-5 pb-28 overflow-hidden"
      >
        <div className="max-w-4xl mx-auto px-4 relative">
          {/* 인사말 한 줄 (App.jsx 헤더 숨김 상태이므로 여기에 표시) */}
          <div className="flex items-start justify-between mb-6">
            <p className="text-sm text-gray-700 pr-4 leading-relaxed pt-1">
              안녕하세요, 오늘도 건강한 하루 되세요! 🌿
            </p>
            <button
              type="button"
              className="relative w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm flex-shrink-0 hover:shadow-md transition"
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

          {/* Health-Platform 로고만 (컴팩트) */}
          <div className="flex items-center gap-1.5">
            <span className="text-lg">🌿</span>
            <span className="font-bold text-emerald-600">Health-Platform</span>
          </div>
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

      {/* 흰색 컨텐츠 카드 — overlap (본인 레퍼런스 비율) */}
      <div className="max-w-4xl mx-auto px-4 -mt-16 relative">
        <div className="bg-white rounded-3xl shadow-xl p-4 sm:p-6 mb-4">

      {/* CTA — 프로그램 생성하기 (컴팩트 + 단색) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Link
          to="/programs/new"
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium py-3 rounded-2xl shadow-md shadow-emerald-200/40 mb-5 transition"
        >
          <Plus className="w-5 h-5" />
          프로그램 생성하기
        </Link>
      </motion.div>

      {/* 통계 4개 카드 — 가로 한 줄 (모바일 4열) + 컴팩트 */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-4 gap-2 mb-6"
      >
        <motion.div
          variants={itemVariants}
          className="bg-white border border-gray-100 rounded-2xl p-2.5 min-w-0 shadow-sm flex flex-col items-center text-center"
        >
          <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center mb-2">
            <ClipboardList className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-[10px] text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis w-full">
            내 프로그램
          </p>
          <p className="text-xl font-bold text-gray-800 leading-tight">
            {myPrograms.length}
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-white border border-gray-100 rounded-2xl p-2.5 min-w-0 shadow-sm flex flex-col items-center text-center"
        >
          <div className="w-8 h-8 bg-sky-100 rounded-xl flex items-center justify-center mb-2">
            <Target className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-[10px] text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis w-full">
            참여 중
          </p>
          <p className="text-xl font-bold text-gray-800 leading-tight">
            {runningCount}
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-white border border-gray-100 rounded-2xl p-2.5 min-w-0 shadow-sm flex flex-col items-center text-center"
        >
          <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center mb-2">
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-[10px] text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis w-full">
            참여 예정
          </p>
          <p className="text-xl font-bold text-gray-800 leading-tight">
            {upcomingPrograms.length}
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-white border border-gray-100 rounded-2xl p-2.5 min-w-0 shadow-sm flex flex-col items-center text-center"
        >
          <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center mb-2">
            <Trophy className="w-4 h-4 text-violet-600" />
          </div>
          <p className="text-[10px] text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis w-full">
            랭킹
          </p>
          <p className="text-xl font-bold text-gray-800 leading-tight whitespace-nowrap overflow-hidden text-ellipsis w-full">
            {totalPoints}<span className="text-xs text-gray-600">P</span>
          </p>
        </motion.div>
      </motion.section>

      {/* 오늘의 미션 — 프로그램별 그루핑 (3개까지만, 전체보기 토글) */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-xl font-medium text-gray-800">
            ✨ 오늘의 미션
          </h2>
          {totalItemCount > 2 && (
            <button
              type="button"
              onClick={() => setShowAllTodayMissions(!showAllTodayMissions)}
              className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700"
            >
              {showAllTodayMissions ? '간단히 보기' : `전체보기 (${totalItemCount})`}
              {!showAllTodayMissions && <ChevronRight className="w-3 h-3" />}
            </button>
          )}
        </div>

        {todayMissions.length === 0 ? (
          <EmptyState
            icon="✨"
            title="오늘 인증할 미션이 없어요"
            description="참여 중인 프로그램이 시작되면 여기에 표시돼요"
          />
        ) : (
          <motion.div layout className="space-y-3">
            <AnimatePresence initial={false}>
            {displayedPrograms.map(programBucket => {
              const catKey = programBucket.program?.categories?.[0] || 'ETC'
              const cat = CATEGORY[catKey] || CATEGORY.ETC
              const colors = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.ETC

              return (
                <motion.div
                  key={programBucket.programId}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  {/* 프로그램 헤더 — 배경 칩으로 시각 분리 */}
                  <div className="flex items-center mb-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-md truncate max-w-full">
                      <span>{cat.emoji}</span>
                      <span className="truncate">{programBucket.program?.name}</span>
                    </span>
                  </div>

                  <div className="grid gap-1.5">
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
                            className={`${colors.bg} ${colors.border} border rounded-xl px-2.5 py-1.5 flex items-center gap-2.5 text-left hover:brightness-95 transition`}
                          >
                            <div className="w-12 h-12 flex-shrink-0 bg-white/70 rounded-xl relative overflow-hidden">
                              <span className="absolute inset-0 flex items-center justify-center text-2xl">
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
                              <h3 className="font-medium text-gray-900 truncate text-base leading-tight">
                                {item.bundleTitle}
                              </h3>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {item.missions.length}개 미션 · 총 +{totalPoint}P
                              </p>
                            </div>

                            {allCompleted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-600 text-xs rounded-full font-medium whitespace-nowrap flex-shrink-0">
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
                          className={`${colors.bg} ${colors.border} border rounded-xl px-2.5 py-1.5 flex items-center gap-2.5`}
                        >
                          <div className="w-8 h-8 flex-shrink-0 bg-white/70 rounded-lg relative overflow-hidden">
                            <span className="absolute inset-0 flex items-center justify-center text-base">
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
                            <h3 className="font-medium text-gray-900 truncate text-base leading-tight">
                              {mission.title}
                            </h3>
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-white/80 text-emerald-700 text-[10px] rounded font-medium">
                              +{mission.point}P
                            </span>
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
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-xl font-medium text-gray-800">
            <Activity className="w-5 h-5 text-emerald-500" />
            내 프로그램
          </h2>
          <div className="flex items-center gap-2">
            {myPrograms.length > 2 && (
              <button
                type="button"
                onClick={() => setShowAllMyPrograms(!showAllMyPrograms)}
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
          <motion.div layout className="grid grid-cols-1 gap-3">
            <AnimatePresence initial={false}>
            {(showAllMyPrograms ? myPrograms : myPrograms.slice(0, 2)).map(program => {
              const isDraft = program.status === 'DRAFT'
              const isUpcoming = !isDraft && isUpcomingByStartDate(program.start_date)
              const statusLabel = isDraft ? '임시저장' : isUpcoming ? '예정' : '진행중'
              const statusClass = (isDraft || isUpcoming)
                ? 'bg-gray-100 text-gray-600'
                : 'bg-emerald-100 text-emerald-700'
              return (
                <motion.div
                  key={program.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  onClick={() => {
                    if (isDraft) {
                      navigate(`/programs/new?id=${program.id}`)
                    } else {
                      setSelectedProgram(program)
                    }
                  }}
                  className="bg-white border border-gray-200 rounded-2xl p-3 hover:shadow-md transition cursor-pointer"
                >
                  <div className="flex gap-3">
                    <ProgramCover
                      imagePath={program.cover_image_path}
                      categories={program.categories}
                      name={program.name}
                      variant="thumb"
                      className="w-16 h-16"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-medium text-gray-800 truncate">{program.name}</h3>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`px-2 py-0.5 rounded text-xs ${statusClass}`}>
                            {statusLabel}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(program)
                            }}
                            disabled={deleteMutation.isPending}
                            className="p-1 text-gray-400 hover:text-red-500 transition disabled:opacity-40"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {program.description && program.description.trim() !== program.name?.trim() && (
                        <p className="text-xs text-gray-600 mb-1 line-clamp-1">
                          {program.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
                      </p>
                      {isDraft && (
                        <p className="text-[11px] text-emerald-600 mt-1">
                          ✏️ 클릭하면 이어서 작성할 수 있어요
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

      {/* 참여 중인 프로그램 — 최대 3개 요약 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-xl font-medium text-gray-800">
            🎯 참여 중인 프로그램
          </h2>
          {activePrograms.length > 2 && (
            <button
              type="button"
              onClick={() => setShowAllActivePrograms(!showAllActivePrograms)}
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
          <motion.div layout className="grid grid-cols-1 gap-3">
            <AnimatePresence initial={false}>
            {(showAllActivePrograms ? activePrograms : activePrograms.slice(0, 2)).map(program => {
              const catKey = program.categories?.[0] || 'ETC'
              const cat = CATEGORY[catKey] || CATEGORY.ETC
              const colors = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.ETC
              const progress = calcProgress(program.start_date, program.end_date)

              return (
                <motion.div
                  key={program.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  onClick={() => navigate(`/programs/${program.id}`)}
                  className={`${colors.bg} ${colors.border} border rounded-2xl p-3 hover:shadow-md transition cursor-pointer flex items-center gap-3`}
                >
                  {/* 표지 사진 — cover_image_path 있으면 그 이미지, 없으면 카테고리 이모지 fallback */}
                  <ProgramCover
                    imagePath={program.cover_image_path}
                    categories={program.categories}
                    name={program.name}
                    variant="thumb"
                    className="w-16 h-16 rounded-2xl"
                  />

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800 truncate">{program.name}</h3>
                    {program.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{program.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 bg-white/80 rounded-full overflow-hidden">
                        <div
                          className={`${colors.accent} h-full rounded-full transition-all`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 font-medium flex-shrink-0">{progress}%</span>
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

        </div>
        {/* 흰색 컨텐츠 카드 끝 */}

        {/* 프로그램 상세 모달 */}
        <ProgramDetailModal
          program={selectedProgram}
          isOpen={selectedProgram !== null}
          onClose={() => setSelectedProgram(null)}
        />

        {/* PUBLISHED 프로그램 삭제 — 이름 재입력 확인 */}
        <DeleteProgramConfirmModal
          program={programToDelete}
          isOpen={programToDelete !== null}
          onClose={() => setProgramToDelete(null)}
          onConfirm={handleConfirmDeletePublished}
        />

      </div>
      {/* 흰색 컨텐츠 카드 wrapper 끝 */}
    </div>
  )
}

export default DashboardPage
