import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, ChevronRight } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../supabaseClient'
import { CATEGORY } from '../lib/constants'
import {
  queryKeys,
  fetchActivePrograms,
  fetchProgramRanking,
  fetchProgramOverview,
} from '../lib/queries'
import UserAvatar from '../components/common/UserAvatar'
import NotificationBell from '../components/common/NotificationBell'
import EmptyState from '../components/common/EmptyState'
import LoadingState from '../components/common/LoadingState'
import GardenPanel from '../components/program/GardenPanel'
import ConstellationPanel from '../components/program/ConstellationPanel'

// 기간(롤링) — 주간=최근 7일 / 월간=최근 30일 (본인 결정 2026-06-19)
const PERIOD_OPTIONS = [
  { value: '7d', label: '주간', badge: '이번 주' },
  { value: '30d', label: '월간', badge: '이번 달' },
]
const periodToISOStart = (period) => {
  const days = period === '7d' ? 7 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

// 범위 — 개인(동작) / 팀·전체(준비중, 추후 프로그램별 팀 생기면 연결)
const SCOPE_TABS = [
  { value: 'individual', label: '개인' },
  { value: 'team', label: '팀' },
  { value: 'all', label: '전체' },
]

function RankingsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const [searchParams, setSearchParams] = useSearchParams()
  const selectedProgramId = searchParams.get('program') || null
  const setSelectedProgramId = (id) => {
    const next = new URLSearchParams(searchParams)
    next.set('program', id)
    setSearchParams(next, { replace: true })
  }
  const [period, setPeriod] = useState('7d')
  const [scope, setScope] = useState('individual')
  const periodStart = useMemo(() => periodToISOStart(period), [period])
  const periodMeta = PERIOD_OPTIONS.find(o => o.value === period)

  const { data: allActivePrograms = [], isLoading: isLoadingPrograms } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })

  // 모든 활성 프로그램 노출 — RANKING / GARDEN / CONSTELLATION 트랙 모두.
  const activePrograms = allActivePrograms.filter(p => {
    const gType = p.gamification_type
    if (gType === 'GARDEN' || gType === 'CONSTELLATION') return true
    if (gType === 'RANKING') return true
    return p.ranking_enabled !== false
  })

  useEffect(() => {
    if (activePrograms.length === 0) return
    if (!selectedProgramId || !activePrograms.some(p => p.id === selectedProgramId)) {
      setSelectedProgramId(activePrograms[0].id)
    }
  }, [activePrograms, selectedProgramId])

  const selectedProgram = activePrograms.find(p => p.id === selectedProgramId)
  const gType = selectedProgram?.gamification_type
  const isGrowthTrack = gType === 'GARDEN' || gType === 'CONSTELLATION'
  const isRankingTrack = gType === 'RANKING' || (!gType && selectedProgram?.ranking_enabled !== false)
  // 팀 기능 플래그 — 추후 등장 예정. 켜진 프로그램만 개인/팀/전체 토글 노출.
  const teamEnabled = !!selectedProgram?.team_enabled

  // ─── 성장 트랙(정원/별자리) 데이터 + 핸들러 ──────────────────
  const { data: myParticipation } = useQuery({
    queryKey: ['my-participation', selectedProgramId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('program_participants').select('*')
        .eq('program_id', selectedProgramId).eq('user_id', userId).maybeSingle()
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
      planted_at: new Date().toISOString(), water_count: 0, sun_count: 0, stage: 0, revealed: false,
    }
    const updated = { ...current, garden: { ...garden, plants: [...garden.plants, newPlant] } }
    const { error } = await supabase.from('program_participants').update({ growth_state: updated })
      .eq('program_id', selectedProgramId).eq('user_id', userId)
    if (error) { console.error('씨앗 심기 실패:', error); return }
    queryClient.invalidateQueries({ queryKey: ['my-participation', selectedProgramId, userId] })
  }
  const handleInitConstellation = async (key) => {
    if (!userId || !selectedProgramId) return
    const current = myParticipation?.growth_state || {}
    const updated = { ...current, constellation: { type: key, stars_lit: 0 } }
    const { error } = await supabase.from('program_participants').update({ growth_state: updated })
      .eq('program_id', selectedProgramId).eq('user_id', userId)
    if (error) { console.error('별자리 초기화 실패:', error); return }
    queryClient.invalidateQueries({ queryKey: ['my-participation', selectedProgramId, userId] })
  }
  const handleUpdateGarden = async (newGarden) => {
    if (!userId || !selectedProgramId) return
    const current = myParticipation?.growth_state || {}
    const updated = { ...current, garden: newGarden }
    const { error } = await supabase.from('program_participants').update({ growth_state: updated })
      .eq('program_id', selectedProgramId).eq('user_id', userId)
    if (error) { console.error('정원 동기화 실패:', error); return }
    queryClient.invalidateQueries({ queryKey: ['my-participation', selectedProgramId, userId] })
  }
  const handleUpdateConstellation = async (newConstellation) => {
    if (!userId || !selectedProgramId) return
    const current = myParticipation?.growth_state || {}
    const updated = { ...current, constellation: newConstellation }
    const { error } = await supabase.from('program_participants').update({ growth_state: updated })
      .eq('program_id', selectedProgramId).eq('user_id', userId)
    if (error) { console.error('별자리 동기화 실패:', error); return }
    queryClient.invalidateQueries({ queryKey: ['my-participation', selectedProgramId, userId] })
  }

  // ─── 랭킹 데이터 ─────────────────────────────────────────
  const { data: ranking = [], isLoading: isLoadingRanking } = useQuery({
    queryKey: queryKeys.programRanking(selectedProgramId, period),
    queryFn: () => fetchProgramRanking(selectedProgramId, periodStart),
    enabled: !!selectedProgramId && isRankingTrack && scope === 'individual',
  })

  const myRow = ranking.find(r => r.user_id === userId)
  const hasPodium = ranking.length >= 3
  const podiumTop3 = hasPodium ? ranking.slice(0, 3) : []
  const restRanking = hasPodium ? ranking.slice(3) : ranking

  // 본인 행 점프 (top3 밖 + viewport 밖일 때 floating 버튼)
  const myRowRef = useRef(null)
  const [isMyRowVisible, setIsMyRowVisible] = useState(true)
  useEffect(() => {
    if (!myRow || myRow.rank <= 3) { setIsMyRowVisible(true); return }
    const el = myRowRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsMyRowVisible(entry.isIntersecting), { threshold: 0.4 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [myRow, ranking.length, selectedProgramId, scope])
  const scrollToMyRow = () => myRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  // ─── 로딩 / 빈 상태 ──────────────────────────────────────
  if (isLoadingPrograms) {
    return (
      <div className="min-h-screen bg-gray-50">
        <RankingHeader />
        <LoadingState variant="page" />
      </div>
    )
  }

  if (activePrograms.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <RankingHeader />
        <div className="w-full max-w-md mx-auto px-4 pt-5">
          <EmptyState
            icon="🏆"
            title="참여 중인 프로그램이 없어요"
            description="프로그램에 참여하면 랭킹이 표시돼요"
            variant="mint" size="lg"
            action={{ label: '프로그램 둘러보기', onClick: () => navigate('/programs') }}
          />
        </div>
      </div>
    )
  }

  // 프로그램 선택 칩
  const programChips = (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
      {activePrograms.map(program => {
        const catKey = program.categories?.[0] || 'ETC'
        const cat = CATEGORY[catKey] || CATEGORY.ETC
        const isActive = program.id === selectedProgramId
        return (
          <button
            key={program.id}
            type="button"
            onClick={() => setSelectedProgramId(program.id)}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 h-[34px] px-3.5 rounded-full text-[13px] font-bold transition ${
              isActive ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            <span>{cat.emoji}</span>
            <span className="max-w-[120px] truncate">{program.name}</span>
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <RankingHeader />

      <div className="w-full max-w-md mx-auto px-4 pt-3 pb-6 space-y-4">
        {/* 배너 — 트로피 일러스트 + 격려 문구 */}
        <RankingBanner badge={periodMeta?.badge} />

        {/* 토글 — 주간/월간 (+ 팀 기능 있는 프로그램만 개인/팀/전체) */}
        <div className="flex items-center justify-between gap-2">
          <Segmented options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
          {teamEnabled && (
            <Segmented options={SCOPE_TABS} value={scope} onChange={setScope} />
          )}
        </div>

        {/* 프로그램 선택 칩 */}
        {programChips}

        {/* ── 성장 트랙(정원/별자리) ── */}
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

        {/* ── 랭킹 트랙 ── */}
        {isRankingTrack && scope !== 'individual' && (
          <ComingSoon label={scope === 'team' ? '팀 랭킹' : '전체 통합 랭킹'} />
        )}

        {isRankingTrack && scope === 'individual' && (
          isLoadingRanking ? (
            <LoadingState />
          ) : ranking.length === 0 ? (
            <EmptyState icon="👥" title="아직 참여자가 없어요" description="첫 인증의 주인공이 되어보세요!" variant="mint" />
          ) : (
            <>
              {hasPodium && <Podium top3={podiumTop3} userId={userId} />}

              {restRanking.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
                  className="bg-white border border-gray-100 rounded-2xl shadow-soft divide-y divide-gray-100 overflow-hidden"
                >
                  {restRanking.map(row => {
                    const isMe = row.user_id === userId
                    return (
                      <div
                        key={row.user_id}
                        ref={isMe ? myRowRef : null}
                        onClick={isMe ? () => navigate(`/profile/activity/${selectedProgramId}/verifications`) : undefined}
                        className={`flex items-center gap-3 px-4 py-3 transition-all ${isMe ? 'bg-emerald-50/60 cursor-pointer hover:bg-emerald-100/60' : ''}`}
                      >
                        <span className="w-6 text-center text-base font-bold text-gray-500 flex-shrink-0">{row.rank}</span>
                        <UserAvatar avatarPath={row.avatar_path} nickname={row.nickname} size="md" />
                        <span className={`flex-1 min-w-0 font-bold truncate ${isMe ? 'text-emerald-800' : 'text-gray-800'}`}>
                          {row.nickname}
                          {isMe && <span className="ml-1.5 text-xs text-emerald-600 font-medium">(나)</span>}
                        </span>
                        <span className="flex-shrink-0 text-emerald-600 font-extrabold">
                          {row.total_score?.toLocaleString()}<span className="text-xs font-bold text-emerald-500 ml-0.5">P</span>
                        </span>
                        {isMe && <ChevronRight className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                      </div>
                    )
                  })}
                </motion.div>
              )}

            </>
          )
        )}
      </div>

      {/* "내 위치로" floating 버튼 */}
      <AnimatePresence>
        {isRankingTrack && scope === 'individual' && myRow && myRow.rank > 3 && !isMyRowVisible && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={scrollToMyRow}
            className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-sm font-medium rounded-full shadow-lg shadow-emerald-500/30"
          >
            <MapPin className="w-4 h-4" />
            내 위치 ({myRow.rank}등)
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── 상단 헤더 (앱 아이콘 + 랭킹 + 알림) ──────────────────────
function RankingHeader() {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-md mx-auto h-[46px] px-4 flex items-center justify-center relative">
        <div className="flex items-center gap-1.5">
          <img src="/app-icon.png" onError={(e) => { e.currentTarget.style.display = 'none' }} alt="" className="w-5 h-5 rounded-md" />
          <span className="text-[17px] font-bold text-gray-800">랭킹</span>
        </div>
        <div className="absolute right-3"><NotificationBell bare /></div>
      </div>
    </header>
  )
}

// ─── 배너 ────────────────────────────────────────────────
function RankingBanner({ badge }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#eef7f1] h-[124px]">
      <img
        src="/illustrations/ranking-banner.png"
        alt="" aria-hidden="true"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: 'center top' }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#eef7f1]/90 via-[#eef7f1]/35 to-transparent" />
      <div className="absolute inset-0 px-5 flex flex-col justify-center max-w-[62%]">
        {badge && (
          <span className="inline-flex self-start items-center px-2 py-0.5 mb-1.5 rounded-md bg-emerald-100 text-emerald-700 text-[11px] font-bold">
            {badge}
          </span>
        )}
        <h2 className="text-[15px] font-bold text-gray-800 leading-snug drop-shadow-sm whitespace-nowrap">꾸준함이 건강을 만듭니다! 💚</h2>
        <p className="mt-1 text-[11px] text-gray-600 whitespace-nowrap">매일의 작은 실천이 큰 변화를 만들어요.</p>
      </div>
    </div>
  )
}

// ─── 세그먼트 토글 ────────────────────────────────────────
function Segmented({ options, value, onChange }) {
  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-full">
      {options.map(opt => {
        const on = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3.5 h-[32px] rounded-full text-[13px] font-bold transition ${
              on ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── 준비중 (팀 / 전체) ───────────────────────────────────
function ComingSoon({ label }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-soft py-12 px-6 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-2xl mb-3">🛠️</div>
      <p className="font-bold text-gray-800">{label}은 곧 제공돼요</p>
      <p className="text-sm text-gray-500 mt-1">조금만 기다려 주세요. 더 즐거운 경쟁을 준비 중이에요!</p>
    </div>
  )
}

// ─── Top 3 시상대 (2-1-3 배치, 1등 강조) ──────────────────
function Podium({ top3, userId }) {
  const [second, first, third] = [top3[1], top3[0], top3[2]]

  const slot = (row, place) => {
    if (!row) return <div />
    const isMe = row.user_id === userId
    const medal = {
      1: { ring: 'ring-amber-300', badge: 'bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-900', emoji: '🥇' },
      2: { ring: 'ring-gray-300', badge: 'bg-gradient-to-br from-gray-200 to-gray-400 text-gray-700', emoji: '🥈' },
      3: { ring: 'ring-orange-300', badge: 'bg-gradient-to-br from-orange-300 to-amber-600 text-orange-900', emoji: '🥉' },
    }[place]
    const isFirst = place === 1

    return (
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, delay: isFirst ? 0.15 : place === 2 ? 0.05 : 0.1, ease: [0.34, 1.4, 0.64, 1] }}
        className={`relative flex flex-col items-center rounded-2xl border bg-white shadow-soft px-2 pb-3 ${
          isFirst ? 'pt-8 -mt-3 border-emerald-200 ring-2 ring-emerald-100' : 'pt-7 border-gray-100'
        } ${isMe ? 'ring-2 ring-emerald-400' : ''}`}
      >
        {/* 메달 뱃지 */}
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 z-10 rounded-full ring-2 ring-white shadow-md flex items-center justify-center font-bold ${
          isFirst ? 'w-9 h-9 text-base' : 'w-7 h-7 text-sm'
        } ${medal.badge}`}>
          {place}
        </div>
        <div className={`rounded-full ring-2 ${medal.ring} ${isFirst ? 'p-0.5' : ''}`}>
          <UserAvatar avatarPath={row.avatar_path} nickname={row.nickname} size={isFirst ? 'lg' : 'md'} />
        </div>
        <p className={`mt-1.5 text-[13px] font-bold truncate w-full text-center ${isMe ? 'text-emerald-800' : 'text-gray-800'}`}>
          {row.nickname}
        </p>
        <p className={`mt-0.5 font-extrabold text-emerald-600 ${isFirst ? 'text-lg' : 'text-base'}`}>
          {row.total_score?.toLocaleString()}<span className="text-[11px] font-bold text-emerald-500 ml-0.5">P</span>
        </p>
        {isMe && <span className="mt-1 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full">나</span>}
      </motion.div>
    )
  }

  return (
    <div className="grid grid-cols-3 items-end gap-2.5">
      {slot(second, 2)}
      {slot(first, 1)}
      {slot(third, 3)}
    </div>
  )
}

export default RankingsPage
