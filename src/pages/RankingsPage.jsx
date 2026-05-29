import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, MapPin, TrendingUp } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { CATEGORY } from '../lib/constants'
import {
  queryKeys,
  fetchActivePrograms,
  fetchProgramRanking,
  fetchMyRecentScoreSeries,
} from '../lib/queries'
import UserAvatar from '../components/common/UserAvatar'
import EmptyState from '../components/common/EmptyState'
import LoadingState from '../components/common/LoadingState'
import PageHeader from '../components/common/PageHeader'

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
  const userId = session?.user?.id

  const [selectedProgramId, setSelectedProgramId] = useState(null)
  const [period, setPeriod] = useState('all')
  const periodStart = useMemo(() => periodToISOStart(period), [period])

  const { data: allActivePrograms = [], isLoading: isLoadingPrograms } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })

  // 랭킹 페이지에서는 ranking_enabled !== false 인 프로그램만 노출
  //   (false 명시한 프로그램은 칩에서 숨김 — 단순 습관 형성 모드)
  const activePrograms = allActivePrograms.filter(p => p.ranking_enabled !== false)

  useEffect(() => {
    if (!selectedProgramId && activePrograms.length > 0) {
      setSelectedProgramId(activePrograms[0].id)
    }
  }, [activePrograms, selectedProgramId])

  const selectedProgram = activePrograms.find(p => p.id === selectedProgramId)

  // 운영자 옵션 — 마법사/Edit 모달에서 켜야만 해당 UI 노출 + fetch
  const trendVisible = !!selectedProgram?.trend_enabled
  const periodFilterVisible = !!selectedProgram?.period_filter_enabled

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
      <div className="px-4 pt-4 max-w-4xl mx-auto">
        <PageHeader>
          <Trophy className="w-6 h-6 text-amber-500" />
          랭킹
        </PageHeader>
        <EmptyState
          icon="🏆"
          title="참여 중인 프로그램이 없어요"
          description="프로그램에 참여하면 랭킹이 표시돼요"
          variant="mint"
          size="lg"
          action={{ label: '프로그램 둘러보기', onClick: () => navigate('/programs') }}
        />
      </div>
    )
  }

  return (
    <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
      <PageHeader>
        <Trophy className="w-6 h-6 text-amber-500" />
        랭킹
      </PageHeader>

      {/* 프로그램 선택 칩 */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-4 scrollbar-hide">
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
                flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm transition
                ${isActive
                  ? 'bg-emerald-500 text-white shadow-sm font-medium'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-emerald-300'}
              `}
            >
              <span>{cat.emoji}</span>
              <span className="max-w-[140px] truncate">{program.name}</span>
            </button>
          )
        })}
      </div>

      {/* 시간 범위 토글 — 운영자가 period_filter_enabled 켰을 때만 노출 */}
      {selectedProgram && periodFilterVisible && (
        <div className="flex gap-1.5 mb-4 p-1 bg-gray-100 rounded-full">
          {PERIOD_OPTIONS.map(opt => {
            const isActive = opt.value === period
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriod(opt.value)}
                className={`
                  flex-1 py-1.5 text-xs font-medium rounded-full transition
                  ${isActive
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'}
                `}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {/* 본인 요약 카드 + 14일 추세 스파크라인 */}
      {selectedProgram && (
        <div className="bg-gradient-to-r from-emerald-50 via-emerald-50/80 to-teal-50 border border-emerald-100 rounded-2xl p-4 mb-4">
          <p className="text-xs text-emerald-700 mb-1">
            {selectedProgram.name}
            {period !== 'all' && (
              <span className="ml-1.5 text-[10px] text-emerald-600/70">
                · {PERIOD_OPTIONS.find(o => o.value === period)?.label} 기준
              </span>
            )}
          </p>
          {isLoadingRanking ? (
            <LoadingState variant="inline" />
          ) : myRow ? (
            <div className="flex items-end gap-3 justify-between">
              <div>
                <div className="flex items-end gap-3">
                  <p className="text-3xl font-bold text-emerald-700 leading-none">
                    {myRow.rank}<span className="text-base font-medium text-emerald-600">등</span>
                  </p>
                  <p className="text-sm text-gray-600 pb-0.5">
                    {myRow.total_score}P
                    <span className="text-gray-400 mx-1">·</span>
                    전체 {ranking.length}명 중
                  </p>
                </div>
              </div>
              {/* 14일 스파크라인 — 운영자가 trend_enabled 켰을 때만 노출 */}
              {trendVisible && myScoreSeries.length > 0 && (
                <ScoreSparkline series={myScoreSeries} />
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              아직 인증 기록이 없어요 — 오늘의 미션부터 도전해보세요
            </p>
          )}
        </div>
      )}

      {/* Top 3 포디움 — 3명 이상일 때만 */}
      {hasPodium && !isLoadingRanking && (
        <PodiumTop3
          top3={podiumTop3}
          userId={userId}
        />
      )}

      {/* 랭킹 목록 (포디움 있으면 4등부터, 없으면 전체) */}
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
          className="grid gap-2"
        >
          {restRanking.map(row => {
            const isMe = row.user_id === userId
            return (
              <div
                key={row.user_id}
                ref={isMe ? myRowRef : null}
                className={`
                  flex items-center justify-between p-3 rounded-2xl border transition-all
                  ${isMe ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-100' : 'bg-white border-gray-200'}
                `}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-50 text-gray-500 text-sm font-medium flex-shrink-0">
                    {row.rank}
                  </span>
                  <UserAvatar avatarPath={row.avatar_path} nickname={row.nickname} size="md" />
                  <span className={`font-medium truncate ${isMe ? 'text-emerald-800' : 'text-gray-800'}`}>
                    {row.nickname}
                    {isMe && <span className="ml-1 text-xs text-emerald-600">(나)</span>}
                  </span>
                </div>
                <span className={`text-sm font-medium flex-shrink-0 ${isMe ? 'text-emerald-700' : 'text-gray-600'}`}>
                  {row.total_score}P
                </span>
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
      <div className="flex items-center gap-0.5 text-[10px] text-emerald-700 mb-0.5">
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
// 1등이 가운데에서 가장 크게, 2등 왼쪽 / 3등 오른쪽이 작게.
// 각 카드: 메달, 닉네임, 점수. 본인이면 emerald 강조.
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
        medal: '🥇',
        crown: '👑',
        rankColor: 'text-amber-700',
        scoreColor: 'text-amber-700',
        height: 'min-h-[11rem]',
        scale: 'scale-100',
      },
      2: {
        gradient: 'from-gray-100 via-gray-50 to-white',
        border: 'border-gray-300',
        medal: '🥈',
        crown: null,
        rankColor: 'text-gray-600',
        scoreColor: 'text-gray-700',
        height: 'min-h-[9rem]',
        scale: 'scale-95',
      },
      3: {
        gradient: 'from-orange-100 via-amber-50/60 to-white',
        border: 'border-orange-200',
        medal: '🥉',
        crown: null,
        rankColor: 'text-orange-700',
        scoreColor: 'text-orange-700',
        height: 'min-h-[8.5rem]',
        scale: 'scale-95',
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
          relative flex flex-col items-center justify-end ${s.height} p-2.5 rounded-2xl border bg-gradient-to-b
          ${s.gradient} ${isMe ? 'ring-2 ring-emerald-400 border-emerald-400' : s.border}
        `}
      >
        {s.crown && (
          <motion.div
            initial={{ opacity: 0, y: -10, rotate: -15 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: 0.55, duration: 0.3, ease: 'easeOut' }}
            className="absolute -top-3 text-2xl"
          >
            {s.crown}
          </motion.div>
        )}
        <UserAvatar avatarPath={row.avatar_path} nickname={row.nickname} size={place === 1 ? 'lg' : 'md'} className="mb-1.5" />
        <div className="text-lg leading-none mb-0.5">{s.medal}</div>
        <p className={`text-[10px] font-bold mb-0.5 ${s.rankColor}`}>{place}등</p>
        <p className={`text-xs font-medium truncate w-full text-center ${isMe ? 'text-emerald-800' : 'text-gray-800'}`}>
          {row.nickname}{isMe && ' (나)'}
        </p>
        <p className={`text-xs font-semibold mt-0.5 ${s.scoreColor}`}>
          {row.total_score}P
        </p>
      </motion.div>
    )
  }

  return (
    <div className="grid grid-cols-3 items-end gap-2 mb-5 mt-2">
      {slot(second, 2)}
      {slot(first, 1)}
      {slot(third, 3)}
    </div>
  )
}

export default RankingsPage
