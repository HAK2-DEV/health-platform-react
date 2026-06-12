import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, MapPin, TrendingUp, ChevronRight } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../supabaseClient'
import { CATEGORY } from '../lib/constants'
import {
  queryKeys,
  fetchActivePrograms,
  fetchProgramRanking,
  fetchMyRecentScoreSeries,
  fetchMyRankChange,
  fetchProgramOverview,
} from '../lib/queries'
import UserAvatar from '../components/common/UserAvatar'
import EmptyState from '../components/common/EmptyState'
import LoadingState from '../components/common/LoadingState'
import GardenPanel from '../components/program/GardenPanel'
import ConstellationPanel from '../components/program/ConstellationPanel'

// 시간 범위 옵션 — period 값을 ISO 시작점 문자열로 변환
const PERIOD_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: '7d', label: '최근 7일' },
  { value: '30d', label: '최근 30일' },
]

const periodToISOStart = (period) => {
  if (period === 'all') return null
  const days = period === '7d' ? 7 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

// 랭킹 페이지 — Bottom Tab Bar 🏆 진입점
// 강화 (Day 55):
//   1) Top 3 포디움 — 2-1-3 레이아웃, 1등은 가운데 + 더 큼 + 👑
//   2) 내 위치로 점프 — 본인 행이 viewport 밖이면 floating 버튼으로 스크롤
function RankingsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  // 선택 프로그램을 URL(?program=)에 보존 → 「내 인증 현황」 등 이동 후 뒤로가기 시 복원
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedProgramId = searchParams.get('program') || null
  const setSelectedProgramId = (id) => {
    const next = new URLSearchParams(searchParams)
    next.set('program', id)
    setSearchParams(next, { replace: true })
  }
  const [period, setPeriod] = useState('all')
  const periodStart = useMemo(() => periodToISOStart(period), [period])

  const { data: allActivePrograms = [], isLoading: isLoadingPrograms } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })

  // Day 65: 모든 활성 프로그램 노출 — RANKING/GARDEN/CONSTELLATION 트랙 모두.
  //   본인 결정 (2026-06-05): 「랭킹 탭 = 성장 탭. 프로그램 선택 후 트랙별 분기」.
  //   기존 ranking_enabled=false 는 GARDEN 으로 마이그레이션 안 됐을 수 있어 같이 표시 차단.
  const activePrograms = allActivePrograms.filter(p => {
    const gType = p.gamification_type
    if (gType === 'GARDEN' || gType === 'CONSTELLATION') return true
    if (gType === 'RANKING') return true
    // legacy — gamification_type 미설정 → ranking_enabled 로 판단
    return p.ranking_enabled !== false
  })

  useEffect(() => {
    if (activePrograms.length === 0) return
    // 선택값 없거나 더는 활성 목록에 없으면 첫 프로그램으로
    if (!selectedProgramId || !activePrograms.some(p => p.id === selectedProgramId)) {
      setSelectedProgramId(activePrograms[0].id)
    }
  }, [activePrograms, selectedProgramId])

  const selectedProgram = activePrograms.find(p => p.id === selectedProgramId)

  // Day 65: 게이미피케이션 트랙 분기.
  const gType = selectedProgram?.gamification_type
  const isGrowthTrack = gType === 'GARDEN' || gType === 'CONSTELLATION'
  const isRankingTrack = gType === 'RANKING' || (!gType && selectedProgram?.ranking_enabled !== false)

  // 운영자 옵션 — 마법사/Edit 모달에서 켜야만 해당 UI 노출 + fetch
  const trendVisible = !!selectedProgram?.trend_enabled
  const periodFilterVisible = !!selectedProgram?.period_filter_enabled

  // Day 65: 성장 트랙 — 본인 참여자 row (growth_state) + overview (activeDays, totalCount)
  const { data: myParticipation } = useQuery({
    queryKey: ['my-participation', selectedProgramId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('program_participants')
        .select('*')
        .eq('program_id', selectedProgramId)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!selectedProgramId && !!userId && isGrowthTrack,
  })

  const { data: growthOverview } = useQuery({
    queryKey: queryKeys.programOverview(selectedProgramId, userId),
    queryFn: () => fetchProgramOverview(selectedProgramId, userId),
    enabled: !!selectedProgramId && !!userId && isGrowthTrack,
  })

  const programDaysForGrowth = useMemo(() => {
    if (!selectedProgram?.start_date || !selectedProgram?.end_date) return 1
    const start = new Date(`${selectedProgram.start_date}T00:00:00+09:00`)
    const end = new Date(`${selectedProgram.end_date}T23:59:59+09:00`)
    return Math.max(1, Math.round((end - start) / 86400000) + 1)
  }, [selectedProgram?.start_date, selectedProgram?.end_date])

  const handlePlantSeed = async (position, flowerKey) => {
    if (!userId || !selectedProgramId) return
    const current = myParticipation?.growth_state || {}
    const garden = current.garden || { plants: [], collection: [] }
    const newPlant = {
      id: crypto.randomUUID(), position, flower_type: flowerKey,
      planted_at: new Date().toISOString(),
      water_count: 0, sun_count: 0, stage: 0, revealed: false,
    }
    const updated = { ...current, garden: { ...garden, plants: [...garden.plants, newPlant] } }
    const { error } = await supabase.from('program_participants')
      .update({ growth_state: updated })
      .eq('program_id', selectedProgramId).eq('user_id', userId)
    if (error) { console.error('씨앗 심기 실패:', error); return }
    queryClient.invalidateQueries({ queryKey: ['my-participation', selectedProgramId, userId] })
  }

  const handleInitConstellation = async (key) => {
    if (!userId || !selectedProgramId) return
    const current = myParticipation?.growth_state || {}
    const updated = { ...current, constellation: { type: key, stars_lit: 0 } }
    const { error } = await supabase.from('program_participants')
      .update({ growth_state: updated })
      .eq('program_id', selectedProgramId).eq('user_id', userId)
    if (error) { console.error('별자리 초기화 실패:', error); return }
    queryClient.invalidateQueries({ queryKey: ['my-participation', selectedProgramId, userId] })
  }

  // Day 65 — 정원·별자리 자동 동기화 (만개 도감, stars_lit 등)
  const handleUpdateGarden = async (newGarden) => {
    if (!userId || !selectedProgramId) return
    const current = myParticipation?.growth_state || {}
    const updated = { ...current, garden: newGarden }
    const { error } = await supabase.from('program_participants')
      .update({ growth_state: updated })
      .eq('program_id', selectedProgramId).eq('user_id', userId)
    if (error) { console.error('정원 동기화 실패:', error); return }
    queryClient.invalidateQueries({ queryKey: ['my-participation', selectedProgramId, userId] })
  }
  const handleUpdateConstellation = async (newConstellation) => {
    if (!userId || !selectedProgramId) return
    const current = myParticipation?.growth_state || {}
    const updated = { ...current, constellation: newConstellation }
    const { error } = await supabase.from('program_participants')
      .update({ growth_state: updated })
      .eq('program_id', selectedProgramId).eq('user_id', userId)
    if (error) { console.error('별자리 동기화 실패:', error); return }
    queryClient.invalidateQueries({ queryKey: ['my-participation', selectedProgramId, userId] })
  }

  const { data: ranking = [], isLoading: isLoadingRanking } = useQuery({
    queryKey: queryKeys.programRanking(selectedProgramId, period),
    queryFn: () => fetchProgramRanking(selectedProgramId, periodStart),
    enabled: !!selectedProgramId,
  })

  // 본인 14일 점수 추세 (선택된 프로그램 + 본인) — sparkline 용
  //   운영자가 trend_enabled 옵션 켜야만 fetch (불필요한 RPC 절약)
  const { data: myScoreSeries = [] } = useQuery({
    queryKey: queryKeys.myRecentScores(selectedProgramId, userId, 14),
    queryFn: () => fetchMyRecentScoreSeries(selectedProgramId, userId, 14),
    enabled: !!selectedProgramId && !!userId && trendVisible,
  })

  const myRow = ranking.find(r => r.user_id === userId)

  // 어제 vs 현재 등수 비교 — 071 rank_snapshots (실제 history).
  // rank_change > 0 = 상승 (양수), 0 = 동일, < 0 = 하락, null = 신규
  // period 가 'all' (또는 미설정) 일 때만 fetch — 7d/30d 는 기간 필터링 결과라 어제 비교 의미 없음.
  const { data: rankChange = null } = useQuery({
    queryKey: queryKeys.myRankChange(selectedProgramId, userId),
    queryFn: () => fetchMyRankChange(selectedProgramId),
    enabled: !!selectedProgramId && !!userId && period === 'all',
  })
  const rankChangeValue = rankChange?.rank_change ?? null
  const rankTrendUp = rankChangeValue != null && rankChangeValue > 0

  // 기간 필터가 꺼져있는데 사용자가 '7d'/'30d' 를 선택한 상태에서 다른 프로그램으로 전환했다면
  // 자동으로 'all' 로 리셋 (운영자가 옵션 끈 의도 존중)
  useEffect(() => {
    if (!periodFilterVisible && period !== 'all') {
      setPeriod('all')
    }
  }, [periodFilterVisible, period])

  // 포디움 / 본인 행 점프 관련 ─────────────────────────────────
  //   포디움은 (1) 프로그램 옵션 podium_enabled=true 이고 (2) 3명 이상일 때만 표시.
  //   미만이거나 옵션 OFF 면 기존 평면 랭킹 그대로.
  //   본인이 top 3 안 들고 viewport 밖이면 floating "내 위치" 버튼.
  const podiumOptIn = !!selectedProgram?.podium_enabled
  const hasPodium = podiumOptIn && ranking.length >= 3
  const podiumTop3 = hasPodium ? ranking.slice(0, 3) : []
  const restRanking = hasPodium ? ranking.slice(3) : ranking

  const myRowRef = useRef(null)
  const [isMyRowVisible, setIsMyRowVisible] = useState(true)
  useEffect(() => {
    // 본인 행이 없거나 top 3 안에 있으면 관찰 불필요
    if (!myRow || myRow.rank <= 3) {
      setIsMyRowVisible(true)
      return
    }
    const el = myRowRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsMyRowVisible(entry.isIntersecting),
      { threshold: 0.4 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [myRow, ranking.length, selectedProgramId])

  const scrollToMyRow = () => {
    myRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // ─── 로딩 ──────────────────────────────────────────────
  if (isLoadingPrograms) {
    return <LoadingState variant="page" />
  }

  // ─── 참여 프로그램 0개 ──────────────────────────────────
  if (activePrograms.length === 0) {
    return (
      <div className="min-h-screen bg-surface-app">
        <RankingHeader />
        <div className="max-w-4xl mx-auto px-3 sm:px-4 -mt-4 relative">
          <EmptyState
            icon="🏆"
            title="참여 중인 프로그램이 없어요"
            description="프로그램에 참여하면 랭킹이 표시돼요"
            variant="mint"
            size="lg"
            action={{ label: '프로그램 둘러보기', onClick: () => navigate('/programs') }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-app">
      <RankingHeader />
      <div className="max-w-4xl mx-auto px-3 sm:px-4 -mt-4 relative space-y-4 pb-6">

      {/* 프로그램 선택 칩 — 참고 사진: 선택은 그린 + 흰 텍스트, 미선택은 흰 카드 */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {activePrograms.map(program => {
          const catKey = program.categories?.[0] || 'ETC'
          const cat = CATEGORY[catKey] || CATEGORY.ETC
          const isActive = program.id === selectedProgramId
          return (
            <button
              key={program.id}
              type="button"
              onClick={() => setSelectedProgramId(program.id)}
              className={`
                flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-pill text-sm transition
                ${isActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-soft font-semibold'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'}
              `}
            >
              <span>{cat.emoji}</span>
              <span className="max-w-[140px] truncate">{program.name}</span>
            </button>
          )
        })}
      </div>

      {/* Day 65: 성장 트랙 — 정원 또는 별자리 패널 (랭킹 대신 노출) */}
      {selectedProgram && gType === 'GARDEN' && (
        <GardenPanel
          participation={myParticipation}
          activeDays={growthOverview?.activeDays || 0}
          totalCount={growthOverview?.totalCount || 0}
          programDays={programDaysForGrowth}
          onPlantSeed={handlePlantSeed}
          onUpdateGarden={handleUpdateGarden}
        />
      )}
      {selectedProgram && gType === 'CONSTELLATION' && (
        <ConstellationPanel
          participation={myParticipation}
          activeDays={growthOverview?.activeDays || 0}
          totalCount={growthOverview?.totalCount || 0}
          programDays={programDaysForGrowth}
          onInitConstellation={handleInitConstellation}
          onUpdateConstellation={handleUpdateConstellation}
        />
      )}

      {/* Day 65: 랭킹 트랙 전용 콘텐츠 (포디움/본인요약/랭킹리스트). 성장 트랙은 위에서 패널만. */}
      {isRankingTrack && (<>
      {/* 시간 범위 토글 — segmented control (운영자가 period_filter_enabled 켰을 때만 노출) */}
      {selectedProgram && periodFilterVisible && (
        <div className="flex gap-1 p-1 bg-gray-100 rounded-pill">
          {PERIOD_OPTIONS.map(opt => {
            const isActive = opt.value === period
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriod(opt.value)}
                className={`
                  flex-1 py-2 text-sm font-medium rounded-pill transition
                  ${isActive
                    ? 'bg-white text-brand-deep shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'}
                `}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {/* 본인 요약 카드 — 참고 사진: 큰 등수 + 점수 + 추세 + 동기부여 박스.
          클릭 시 「내 인증 현황」(나의 활동)으로 이동 — 포디움 여부와 무관하게 항상 진입 가능. */}
      {selectedProgram && (
        <div
          onClick={() => navigate(`/profile/activity/${selectedProgramId}/verifications`)}
          className="bg-surface-mint border border-emerald-100 rounded-card-lg p-5 shadow-soft cursor-pointer hover:border-emerald-200 hover:bg-emerald-50/40 transition"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-sm font-semibold text-emerald-700 truncate">
              {selectedProgram.name}
              {period !== 'all' && (
                <span className="ml-1.5 text-xs font-normal text-emerald-600/70">
                  · {PERIOD_OPTIONS.find(o => o.value === period)?.label} 기준
                </span>
              )}
            </p>
            {trendVisible && myScoreSeries.length > 0 && (
              <ScoreSparkline series={myScoreSeries} />
            )}
          </div>
          {isLoadingRanking ? (
            <LoadingState variant="inline" />
          ) : myRow ? (
            <>
              <div className="flex items-baseline gap-3 flex-wrap">
                <p className="text-4xl font-bold text-brand-deep leading-none">
                  {myRow.rank}<span className="text-xl font-bold text-brand-primary ml-0.5">등</span>
                  <span className="ml-1 text-yellow-400 text-xl">✨</span>
                </p>
                <p className="text-2xl font-bold text-gray-800">
                  {myRow.total_score}<span className="text-sm text-gray-500 font-medium ml-0.5">P</span>
                </p>
                <p className="text-xs text-gray-500">· 전체 {ranking.length}명 중</p>
              </div>
              {rankTrendUp && (
                <p className="mt-4 px-3 py-2 bg-white/60 text-xs text-emerald-700 rounded-pill text-center flex items-center justify-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>꾸준한 참여로 순위가 상승하고 있어요! 👏</span>
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">
              아직 인증 기록이 없어요 — 오늘의 미션부터 도전해보세요
            </p>
          )}
          <p className="mt-3 pt-3 border-t border-emerald-100/70 text-[11px] text-emerald-600 flex items-center justify-end gap-0.5">
            내 인증 현황 보기 <ChevronRight className="w-3 h-3" />
          </p>
        </div>
      )}

      {/* Top 3 포디움 — 3명 이상일 때만 */}
      {hasPodium && !isLoadingRanking && (
        <PodiumTop3
          top3={podiumTop3}
          userId={userId}
        />
      )}

      {/* 랭킹 목록 (포디움 있으면 4등부터, 없으면 전체) — 흰 카드 + 행 구분선 */}
      {isLoadingRanking ? (
        <LoadingState />
      ) : ranking.length === 0 ? (
        <EmptyState icon="👥" title="아직 참여자가 없어요" />
      ) : restRanking.length === 0 ? (
        // 정확히 3명 — 포디움만 (리스트 비움)
        null
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-white border border-gray-100 rounded-card-lg shadow-soft divide-y divide-gray-100"
        >
          {restRanking.map(row => {
            const isMe = row.user_id === userId
            // 내 행만 클릭 가능 — 「내 인증 현황」(나의 활동)으로 이동. (남의 인증 내역은 권한상 비공개)
            return (
              <div
                key={row.user_id}
                ref={isMe ? myRowRef : null}
                onClick={isMe ? () => navigate(`/profile/activity/${selectedProgramId}/verifications`) : undefined}
                className={`
                  flex items-center justify-between gap-3 px-4 py-3 transition-all
                  ${isMe ? 'bg-emerald-50/50 hover:bg-emerald-100/60 cursor-pointer' : ''}
                `}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-gray-500 text-base font-bold flex-shrink-0 w-6 text-center">
                    {row.rank}
                  </span>
                  <UserAvatar avatarPath={row.avatar_path} nickname={row.nickname} size="md" />
                  <span className={`font-semibold truncate ${isMe ? 'text-emerald-800' : 'text-gray-800'}`}>
                    {row.nickname}
                    {isMe && <span className="ml-1.5 text-xs text-emerald-600 font-medium">(나)</span>}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className={`text-sm font-bold ${isMe ? 'text-emerald-700' : 'text-emerald-600'}`}>
                    {row.total_score}P
                  </span>
                  {isMe && <ChevronRight className="w-4 h-4 text-emerald-400" />}
                </div>
              </div>
            )
          })}
        </motion.div>
      )}

      {/* "내 위치로" floating 버튼 — 본인 행이 viewport 밖일 때만 */}
      <AnimatePresence>
        {myRow && myRow.rank > 3 && !isMyRowVisible && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={scrollToMyRow}
            className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm font-medium rounded-full shadow-lg shadow-emerald-500/30 transition"
          >
            <MapPin className="w-4 h-4" />
            내 위치 ({myRow.rank}등)
          </motion.button>
        )}
      </AnimatePresence>
      </>)}
      </div>
    </div>
  )
}

// 랭킹 페이지 헤더 — 큰 제목 + 부제 + 트로피 일러스트 (참고 사진)
function RankingHeader() {
  return (
    <div className="relative bg-gradient-to-b from-emerald-100 via-emerald-50/80 to-teal-50/40 pt-6 pb-6 overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 relative">
        <h1 className="text-2xl font-bold text-gray-800">🏆 랭킹</h1>
        <p className="text-sm font-medium text-gray-700 mt-1.5">참여 진도와 포인트를 비교해보세요!</p>
      </div>
      {/* 트로피 일러스트 — 우상단 */}
      <div className="absolute top-4 right-4 w-24 h-24 sm:w-28 sm:h-28 opacity-90 pointer-events-none select-none">
        <span className="absolute inset-0 flex items-center justify-center text-5xl">🏆</span>
      </div>
    </div>
  )
}

// ─── 14일 점수 스파크라인 ────────────────────────────────────
// SVG polyline + 마지막 점 강조. 모든 점수 0 이면 일직선 (max=1 로 가드).
function ScoreSparkline({ series }) {
  const w = 88
  const h = 32
  const max = Math.max(1, ...series.map(s => s.point))
  const stepX = series.length > 1 ? w / (series.length - 1) : w
  const pointsStr = series.map((s, i) => {
    const x = i * stepX
    const y = h - (s.point / max) * h
    return `${x},${y}`
  }).join(' ')
  const last = series[series.length - 1]
  const lastX = (series.length - 1) * stepX
  const lastY = h - (last.point / max) * h
  const total14d = series.reduce((sum, s) => sum + s.point, 0)
  return (
    <div className="flex flex-col items-end flex-shrink-0">
      <div className="flex items-center gap-0.5 text-xs text-emerald-700 mb-0.5">
        <TrendingUp className="w-3 h-3" />
        <span>14일 +{total14d}P</span>
      </div>
      <svg width={w} height={h} className="overflow-visible">
        <polyline
          points={pointsStr}
          fill="none"
          stroke="rgb(16, 185, 129)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={lastX} cy={lastY} r="2.5" fill="rgb(16, 185, 129)" />
      </svg>
    </div>
  )
}

// ─── Top 3 포디움 — 2-1-3 레이아웃 ───────────────────────────
// 1등 가운데/가장 크게, 2등 왼쪽/3등 오른쪽 작게.
// Day 65: 메달을 원형 숫자 뱃지(참고 사진) 로 교체 + 빵빠레(confetti) 등장 모션.
function PodiumTop3({ top3, userId }) {
  // top3[0]=1등, top3[1]=2등, top3[2]=3등
  // 시각 배치: 2등 - 1등 - 3등
  const [second, first, third] = [top3[1], top3[0], top3[2]]

  const slot = (row, place) => {
    if (!row) return <div />
    const isMe = row.user_id === userId
    const styleByPlace = {
      1: {
        gradient: 'from-yellow-100 via-amber-50 to-yellow-50',
        border: 'border-amber-300',
        rankColor: 'text-amber-700',
        scoreColor: 'text-amber-700',
        height: 'min-h-[11rem]',
      },
      2: {
        gradient: 'from-gray-100 via-gray-50 to-white',
        border: 'border-gray-300',
        rankColor: 'text-gray-600',
        scoreColor: 'text-gray-700',
        height: 'min-h-[9rem]',
      },
      3: {
        gradient: 'from-orange-100 via-amber-50/60 to-white',
        border: 'border-orange-200',
        rankColor: 'text-orange-700',
        scoreColor: 'text-orange-700',
        height: 'min-h-[8.5rem]',
      },
    }
    const s = styleByPlace[place]

    return (
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: place === 1 ? 1 : 0.95 }}
        transition={{
          duration: 0.45,
          delay: place === 1 ? 0.2 : place === 2 ? 0.05 : 0.1,
          ease: [0.34, 1.4, 0.64, 1],
        }}
        className={`
          relative flex flex-col items-center justify-end ${s.height} pt-7 px-3 pb-3 rounded-card border bg-gradient-to-b shadow-soft
          ${s.gradient} ${isMe ? 'ring-2 ring-emerald-400 border-emerald-400' : s.border}
        `}
      >
        {/* 1등 왕관 — 메달 위에 살짝 떠 있음 */}
        {place === 1 && (
          <motion.div
            initial={{ opacity: 0, y: -10, rotate: -15 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: 0.6, duration: 0.3, ease: 'easeOut' }}
            className="absolute -top-7 text-3xl select-none"
          >
            👑
          </motion.div>
        )}
        {/* 숫자 메달 뱃지 — 카드 상단에 오버레이 */}
        <PodiumMedalBadge place={place} />

        <UserAvatar
          avatarPath={row.avatar_path}
          nickname={row.nickname}
          size={place === 1 ? 'lg' : 'md'}
          className="mb-1.5"
        />
        {isMe && (
          <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs font-semibold rounded-pill mb-0.5">나</span>
        )}
        <p className={`text-xs font-semibold truncate w-full text-center ${isMe ? 'text-emerald-800' : 'text-gray-800'}`}>
          {row.nickname}
        </p>
        <p className={`text-sm font-bold mt-0.5 ${s.scoreColor}`}>
          {row.total_score}P
        </p>
      </motion.div>
    )
  }

  return (
    <div className="relative bg-white border border-gray-100 rounded-card-lg shadow-soft p-4 overflow-hidden">
      {/* 빵빠레 (confetti) — 1등 카드 등장 직후 1회 분출 */}
      <ConfettiBurst />
      <div className="relative grid grid-cols-3 items-end gap-2 pt-3">
        {slot(second, 2)}
        {slot(first, 1)}
        {slot(third, 3)}
      </div>
    </div>
  )
}

// 1·2·3등 원형 메달 뱃지 — 골드/실버/브론즈 그라데이션 + 숫자.
// 1등은 시각 강조로 더 크게, 2·3등은 동일하게 작게.
function PodiumMedalBadge({ place }) {
  const styles = {
    1: 'bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-900 shadow-amber-300/60',
    2: 'bg-gradient-to-br from-gray-200 to-gray-400 text-gray-700 shadow-gray-300/60',
    3: 'bg-gradient-to-br from-orange-300 to-amber-600 text-orange-900 shadow-orange-300/60',
  }
  // 1등: 큰 뱃지(w-11/text-lg), 2·3등: 작은 뱃지(w-8/text-sm)
  const sizeCls = place === 1
    ? 'w-11 h-11 -top-4 text-lg'
    : 'w-8 h-8 -top-3 text-sm'
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: 0.4 + place * 0.04,
        duration: 0.35,
        ease: [0.34, 1.5, 0.64, 1],
      }}
      className={`absolute left-1/2 -translate-x-1/2 z-10 rounded-full ring-2 ring-white shadow-lg flex items-center justify-center ${sizeCls} ${styles[place]}`}
    >
      <span className="font-bold leading-none">{place}</span>
    </motion.div>
  )
}

// 빵빠레 — 포디움 등장 직후 1회 분출. 색 confetti 입자가 사방으로 흩어지며 회전·페이드.
const CONFETTI_COLORS = ['#fcd34d', '#34d399', '#fb923c', '#f472b6', '#a78bfa', '#60a5fa']
function ConfettiBurst() {
  // 입자 위치/회전 안정화 — 매 렌더마다 새로 생성되면 애니메이션이 점프함.
  // delay 0~0.15s: 포디움 카드 등장 모션과 동시에 분출 (1등 카드 delay 0.2 보다 살짝 빠르게 시작).
  const particles = useMemo(() => Array.from({ length: 24 }).map((_, i) => ({
    angle: (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
    dist: 60 + Math.random() * 80,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 4 + Math.random() * 5,
    rot: (Math.random() - 0.5) * 720,
    delay: Math.random() * 0.15,
    isSquare: i % 2 === 0,
  })), [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {particles.map((p, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: Math.cos(p.angle) * p.dist,
            y: Math.sin(p.angle) * p.dist + 40,  // 약간 아래로 떨어지는 느낌
            opacity: 0,
            rotate: p.rot,
          }}
          transition={{ delay: p.delay, duration: 1.4, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            left: '50%',
            top: '38%',  // 1등 카드 메달 근처에서 분출
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.isSquare ? '2px' : '50%',
          }}
        />
      ))}
    </div>
  )
}

export default RankingsPage
