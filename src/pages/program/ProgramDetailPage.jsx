import { useState, useMemo, useRef, lazy, Suspense } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { ChevronLeft, Plus, ChevronRight, Users, Trophy, Pencil, Calendar, Activity, Award, Flame, Check } from 'lucide-react'
import DoorIcon from '../../components/common/DoorIcon'
import { supabase } from '../../supabaseClient'
import { CATEGORY } from '../../lib/constants'
import { formatKoreanDate, formatKoreanDateTime, isUpcomingByStartDate } from '../../lib/formatters'
import MissionCard from '../../components/program/MissionCard'
import GardenPanel from '../../components/program/GardenPanel'
import ConstellationPanel from '../../components/program/ConstellationPanel'
import PodiumTop3 from '../../components/program/PodiumTop3'
import ScoreSparkline from '../../components/program/ScoreSparkline'
import StickyBackBar from '../../components/common/StickyBackBar'
import Modal from '../../components/common/Modal'
import ProfileButton from '../../components/common/ProfileButton'
import NotificationBell from '../../components/common/NotificationBell'
import UserAvatar from '../../components/common/UserAvatar'
import EmptyState from '../../components/common/EmptyState'
import LoadingState from '../../components/common/LoadingState'
import ProgramCover from '../../components/common/ProgramCover'
import MarkdownView from '../../components/common/MarkdownView'
import { calcProgress, progressUrgency } from '../../lib/programVisuals'

// 홈 화면과 동일한 채워진(solid) 아이콘 — 참여자/내순위용 (heroicons solid, MIT)
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

// lazy 분리 — 실제 사용 시점에 chunk 다운로드 (Day 65 본인 결정)
//   FeedContent: 커뮤니티 탭 진입 시
//   모달 4개: 운영자가 해당 액션 클릭 시
//   react-markdown 은 MarkdownView 와 OverviewEditModal 둘 다 사용 → 공통 chunk 로 분리됨
const FeedContent = lazy(() => import('../../components/program/FeedContent'))
const ProgramEditModal = lazy(() => import('../../components/program/ProgramEditModal'))
const MissionCreateModal = lazy(() => import('../../components/program/MissionCreateModal'))
const MissionLibraryModal = lazy(() => import('../../components/program/MissionLibraryModal'))
const OverviewEditModal = lazy(() => import('../../components/program/OverviewEditModal'))
const ProgramDetailModal = lazy(() => import('../../components/program/ProgramDetailModal'))
const ParticipantApprovalModal = lazy(() => import('../../components/program/ParticipantApprovalModal'))
const InviteModal = lazy(() => import('../../components/program/InviteModal'))
import {
  queryKeys,
  fetchProgram,
  fetchProgramMissions,
  fetchProgramScores,
  fetchProgramRanking,
  fetchMyRecentScoreSeries,
  fetchTodayCounts,
  fetchParticipantQuizzes,
  fetchProgramOverview,
} from '../../lib/queries'

// 기간 필터 옵션 (period_filter_enabled 옵션 시) — period → ISO 시작점
const PERIOD_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: '7d', label: '최근 7일' },
  { value: '30d', label: '최근 30일' },
]
const periodToISOStart = (p) => {
  if (p === 'all') return null
  const days = p === '7d' ? 7 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function ProgramDetailPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isOverviewEditOpen, setIsOverviewEditOpen] = useState(false)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const [isMissionCreateOpen, setIsMissionCreateOpen] = useState(false)
  const [editingMission, setEditingMission] = useState(null)  // 미션 수정 — null 이면 생성 모드
  const [showAllMissions, setShowAllMissions] = useState(false)
  const [showAllQuizzes, setShowAllQuizzes] = useState(false)
  const [showAllRanking, setShowAllRanking] = useState(false)

  // 탭 상태 — 개요(overview) / 미션(missions) / 퀴즈(quizzes) / 커뮤니티(community) / 랭킹(ranking)
  //   마법사에서 ranking 비활성화 시 랭킹 탭 자동 숨김 (program.ranking_enabled === false)
  // Day 65: URL searchParam (?tab=) 으로 관리 — 미션 클릭 후 인증 페이지에서 뒤로가기 시
  //   탭 상태가 보존됨 (이전엔 useState 라 항상 overview 로 리셋됨).
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'
  const setActiveTab = (key) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (key === 'overview') next.delete('tab')
      else next.set('tab', key)
      return next
    }, { replace: true })
  }

  // 전체보기 토글 시 해당 섹션 viewport 상단으로
  const missionSectionRef = useRef(null)
  const quizSectionRef = useRef(null)
  const scrollToSection = (ref) => {
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  // 5개 useQuery 로 분리 — 각각 독립 캐시. 다른 화면(대시보드/랭킹/묶음 디테일)도 같은 키 공유.
  const { data: program, isLoading: isProgramLoading, error: programError } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })

  const { data: missions = [] } = useQuery({
    queryKey: queryKeys.programMissions(id),
    queryFn: () => fetchProgramMissions(id),
    enabled: !!session && !!id,
  })

  const { data: scores = { total: 0, today: 0 } } = useQuery({
    queryKey: queryKeys.programScores(id, userId),
    queryFn: () => fetchProgramScores(id, userId),
    enabled: !!session && !!id,
  })

  const [period, setPeriod] = useState('all')
  const periodStart = useMemo(() => periodToISOStart(period), [period])
  const periodFilterVisible = !!program?.period_filter_enabled
  const { data: ranking = [] } = useQuery({
    queryKey: queryKeys.programRanking(id, period),
    queryFn: () => fetchProgramRanking(id, periodStart),
    enabled: !!session && !!id,
  })

  // 추세 sparkline — 운영자가 trend_enabled 켰을 때만 fetch (불필요 RPC 절약)
  const trendVisible = !!program?.trend_enabled
  const { data: myScoreSeries = [] } = useQuery({
    queryKey: queryKeys.myRecentScores(id, userId, 14),
    queryFn: () => fetchMyRecentScoreSeries(id, userId, 14),
    enabled: !!session && !!id && !!userId && trendVisible,
  })

  // 시상대 — podium_enabled + 3명 이상일 때만. 미만/OFF 면 기존 평면 랭킹.
  const hasPodium = !!program?.podium_enabled && ranking.length >= 3
  const podiumTop3 = hasPodium ? ranking.slice(0, 3) : []
  const restRanking = hasPodium ? ranking.slice(3) : ranking

  const { data: todayCounts = {} } = useQuery({
    queryKey: queryKeys.todayCounts(userId),
    queryFn: () => fetchTodayCounts(userId),
    enabled: !!session,
  })

  // 「개요」 탭 모의도 데이터 — streak + activeDays + recent 한 번에
  const { data: overviewData } = useQuery({
    queryKey: queryKeys.programOverview(id, userId),
    queryFn: () => fetchProgramOverview(id, userId),
    enabled: !!session && !!id && !!userId,
  })

  // Day 65 게이미피케이션 — 본인 참여자 row (growth_state JSONB 보유).
  // 정원/별자리 트랙일 때만 fetch.
  const isGrowthTrack = program?.gamification_type === 'GARDEN' || program?.gamification_type === 'CONSTELLATION'
  const { data: myParticipation } = useQuery({
    queryKey: ['my-participation', id, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('program_participants')
        .select('*')
        .eq('program_id', id)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!session && !!id && !!userId && isGrowthTrack,
  })

  // 정원/별자리에 전달할 프로그램 일수 — start/end 차이 (KST).
  const programDaysForGrowth = useMemo(() => {
    if (!program?.start_date || !program?.end_date) return 1
    const start = new Date(`${program.start_date}T00:00:00+09:00`)
    const end = new Date(`${program.end_date}T23:59:59+09:00`)
    return Math.max(1, Math.round((end - start) / 86400000) + 1)
  }, [program?.start_date, program?.end_date])

  // 정원 — 씨앗 심기 (위치 + 추첨된 꽃 key). growth_state.garden.plants 에 추가.
  const handlePlantSeed = async (position, flowerKey) => {
    if (!userId || !id) return
    const current = myParticipation?.growth_state || {}
    const garden = current.garden || { plants: [], collection: [] }
    const newPlant = {
      id: crypto.randomUUID(),
      position,
      flower_type: flowerKey,
      planted_at: new Date().toISOString(),
      water_count: 0,
      sun_count: 0,
      stage: 0,
      revealed: false,
    }
    const updated = { ...current, garden: { ...garden, plants: [...garden.plants, newPlant] } }
    const { error } = await supabase
      .from('program_participants')
      .update({ growth_state: updated })
      .eq('program_id', id)
      .eq('user_id', userId)
    if (error) { console.error('씨앗 심기 실패:', error); return }
    queryClient.invalidateQueries({ queryKey: ['my-participation', id, userId] })
  }

  // 별자리 — 첫 로드 시 랜덤 추첨 결과 저장.
  const handleInitConstellation = async (key) => {
    if (!userId || !id) return
    const current = myParticipation?.growth_state || {}
    const updated = { ...current, constellation: { type: key, stars_lit: 0 } }
    const { error } = await supabase
      .from('program_participants')
      .update({ growth_state: updated })
      .eq('program_id', id)
      .eq('user_id', userId)
    if (error) { console.error('별자리 초기화 실패:', error); return }
    queryClient.invalidateQueries({ queryKey: ['my-participation', id, userId] })
  }

  // 정원 자동 동기화 (만개 시 도감 추가 등) — GardenPanel useEffect 가 호출.
  const handleUpdateGarden = async (newGarden) => {
    if (!userId || !id) return
    const current = myParticipation?.growth_state || {}
    const updated = { ...current, garden: newGarden }
    const { error } = await supabase
      .from('program_participants')
      .update({ growth_state: updated })
      .eq('program_id', id).eq('user_id', userId)
    if (error) { console.error('정원 동기화 실패:', error); return }
    queryClient.invalidateQueries({ queryKey: ['my-participation', id, userId] })
  }

  // 별자리 자동 동기화 (stars_lit) — ConstellationPanel useEffect 가 호출.
  const handleUpdateConstellation = async (newConstellation) => {
    if (!userId || !id) return
    const current = myParticipation?.growth_state || {}
    const updated = { ...current, constellation: newConstellation }
    const { error } = await supabase
      .from('program_participants')
      .update({ growth_state: updated })
      .eq('program_id', id).eq('user_id', userId)
    if (error) { console.error('별자리 동기화 실패:', error); return }
    queryClient.invalidateQueries({ queryKey: ['my-participation', id, userId] })
  }

  const isOwner = program?.owner_id === userId

  // 참가자용 퀴즈 목록 — 참여자(비운영자)에게만. owner 는 게시물 관리로.
  const { data: participantQuizzes = [] } = useQuery({
    queryKey: queryKeys.participantQuizzes(id, userId),
    queryFn: () => fetchParticipantQuizzes(id),
    enabled: !!session && !!id && !!program && !isOwner,
  })

  // 본인 참여 상태 (자가 탈퇴 버튼용 + 비공개 접근 가드) — 비운영자만
  const { data: myPart, isLoading: isMyPartLoading } = useQuery({
    queryKey: ['my-part-status', id, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('program_participants')
        .select('id, status')
        .eq('program_id', id)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!session && !!id && !!userId && !isOwner,
  })
  const isActiveParticipant = myPart?.status === 'ACTIVE'

  // 열람 모드 — 미리보기 허용(preview_enabled) 프로그램의 비참여자. 보기만, 쓰기 차단.
  //   is_public(검색 노출)과 무관 — 내부 열람은 preview_enabled 가 결정.
  const isViewer = !!program && !isOwner && !isActiveParticipant && program.preview_enabled && program.status === 'PUBLISHED'
  const [joinOpen, setJoinOpen] = useState(false)
  const [isApprovalsOpen, setIsApprovalsOpen] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  // 승인 대기 신청자 수 — 운영자 패널 「참여자 승인 심사」 배지
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['program-pending-count', id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('program_participants')
        .select('id', { count: 'exact', head: true })
        .eq('program_id', id)
        .eq('status', 'PENDING')
      if (error) throw error
      return count || 0
    },
    enabled: !!session && !!id && isOwner,
  })

  // 참여자 자가 탈퇴 — status='LEFT' (RLS: 본인 행 UPDATE 허용). 랭킹·집계서 제외, 기록 보존.
  const leaveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('program_participants')
        .update({ status: 'LEFT', left_at: new Date().toISOString() })
        .eq('program_id', id)
        .eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-part-status', id, userId] })
      queryClient.invalidateQueries({ queryKey: queryKeys.activePrograms(userId) })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      navigate('/programs')
    },
    onError: (err) => {
      console.error('탈퇴 실패:', err)
      alert(`탈퇴에 실패했어요: ${err.message}`)
    },
  })
  const handleLeave = () => {
    if (!window.confirm(`"${program.name}" 프로그램에서 나갈까요?\n랭킹·집계에서 빠지고, 다시 참여해야 활동할 수 있어요. (기록은 보존)`)) return
    leaveMutation.mutate()
  }

  // 미션 그루핑 — bundle_title 별. null = 직접 만들기 (단독 카드), string = 라이브러리 묶음 (그룹 카드)
  const missionGroups = useMemo(() => {
    const map = new Map()
    for (const m of missions) {
      const key = m.bundle_title || null
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(m)
    }
    return Array.from(map.entries()).map(([bundleTitle, ms]) => ({ bundleTitle, missions: ms }))
  }, [missions])

  // 카드 단위 평탄화 — 전체보기 토글의 카드 수 카운트 + 슬라이스용
  // 단독 그룹의 각 미션 = 카드 1개, 묶음 그룹 전체 = 카드 1개
  const missionCards = useMemo(() => {
    const cards = []
    for (const group of missionGroups) {
      if (group.bundleTitle === null) {
        for (const m of group.missions) cards.push({ kind: 'solo', mission: m })
      } else {
        cards.push({ kind: 'bundle', group })
      }
    }
    return cards
  }, [missionGroups])
  const displayedMissionCards = showAllMissions ? missionCards : missionCards.slice(0, 3)

  // 모달 mutation 후 갱신 헬퍼
  const invalidateProgramData = () => {
    // 상세 + 미션 외에, 다른 페이지(Dashboard/ProgramList)의 myPrograms/activePrograms/publicPrograms 도
    // 모두 갱신해야 표지/이름 변경이 즉시 반영됨. ['programs'] prefix 로 전부 무효화.
    queryClient.invalidateQueries({ queryKey: ['programs'] })
    // ['missions'] 전체 무효화 — 목록(byProgram) + 인증 화면(detail) + 오늘의 미션 모두 갱신
    queryClient.invalidateQueries({ queryKey: ['missions'] })
  }

  // 미션 삭제 — CASCADE 로 verifications + score_ledgers 함께 사라짐
  const deleteMissionMutation = useMutation({
    mutationFn: async (missionId) => {
      const { error } = await supabase
        .from('missions')
        .delete()
        .eq('id', missionId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programMissions(id) })
      queryClient.invalidateQueries({ queryKey: ['missions', 'today'] })
      queryClient.invalidateQueries({ queryKey: ['scores'] })
      queryClient.invalidateQueries({ queryKey: ['verifications'] })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (err) => {
      console.error('미션 삭제 실패:', err)
      alert(`미션 삭제에 실패했습니다: ${err.message}`)
    },
  })

  const handleMissionDelete = (mission) => {
    if (!window.confirm(
      `⚠️ "${mission.title}" 미션을 삭제하면\n` +
      `참가자의 모든 인증 기록과 부여된 점수가 함께 삭제됩니다.\n` +
      `되돌릴 수 없어요.`
    )) return
    if (!window.confirm('그래도 삭제하시겠습니까?')) return
    deleteMissionMutation.mutate(mission.id)
  }

  if (isProgramLoading) {
    return (
      <LoadingState variant="page" />
    )
  }

  if (programError || !program) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="p-4 bg-red-100 text-red-700 rounded">프로그램을 찾을 수 없습니다</p>
        <Link to="/dashboard" className="block mt-4 text-emerald-600 hover:underline">
          ← 대시보드로
        </Link>
      </div>
    )
  }

  // 비공개 접근 차단 — 비운영자·비참여자가 공개 아닌(또는 미발행) 프로그램에 들어오면 잠금.
  //   공개 프로그램은 isViewer(열람 모드)로 통과. 참여 상태 로딩 중엔 깜빡임 방지.
  if (!isOwner && isMyPartLoading) {
    return <LoadingState variant="page" />
  }
  if (!isOwner && !isActiveParticipant && !isViewer) {
    return (
      <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
        <StickyBackBar fallbackPath="/programs" title="둘러보기로" />
        <div className="text-center py-16">
          <div className="text-5xl mb-3 leading-none">🔒</div>
          <p className="text-lg font-bold text-gray-800 mb-1">비공개 프로그램이에요</p>
          <p className="text-sm text-gray-500">초대·링크로 참여한 회원만 볼 수 있어요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      {/* 상단 헤더 — 뒤로 + 제목 + 알림 + 프로필 (풀폭, 모서리 0) */}
      <header className="sticky top-0 z-30 -mx-4 -mt-2 mb-[6px] bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto h-[44px] px-2 flex items-center justify-center relative">
          <button type="button" onClick={() => navigate(-1)} className="absolute left-2 p-1.5 text-gray-600 hover:text-gray-900" aria-label="뒤로">
            <ChevronLeft className="w-5 h-5" />
          </button>
          {/* 제목 — 항상 화면 정중앙 (좌우 버튼 폭과 무관) */}
          <span className="text-[16px] font-bold text-gray-800 truncate max-w-[58%] px-1">{program.name}</span>
          <div className="absolute right-2 flex items-center gap-0.5">
            <NotificationBell bare />
            <ProfileButton bare />
          </div>
        </div>
      </header>

      {/* 프로그램 헤더 — 모의도 디자인: 배경 사진 풀 블리드 + 우측 페이드 + 진행중 배지 */}
      {(() => {
        const isPublished = program.status === 'PUBLISHED'
        const isUpcoming = isPublished && isUpcomingByStartDate(program.start_date)
        const isDraft = program.status === 'DRAFT'
        const statusLabel = isDraft ? '임시저장' : isPublished ? (isUpcoming ? '예정' : '진행중') : program.status
        const statusCls = isDraft
          ? 'bg-gray-500 text-white'
          : (isPublished && !isUpcoming)
            ? 'bg-emerald-500 text-white'
            : 'bg-amber-500 text-white'
        const progress = calcProgress(program.start_date, program.end_date)
        const urgency = progressUrgency(progress)
        const totalDays = program.start_date && program.end_date
          ? Math.round((new Date(program.end_date) - new Date(program.start_date)) / 86400000) + 1
          : null

        // 본인 순위 — ranking 배열에서 찾기 (랭킹 활성 시만 표시)
        const myRow = ranking.find(r => r.user_id === userId)
        const myRank = myRow?.rank

        // 배경 사진 URL (cover_image_path → 공개 URL, 없으면 카테고리 이모지 fallback)
        const publicUrl = program.cover_image_path
          ? supabase.storage.from('program-covers').getPublicUrl(program.cover_image_path).data?.publicUrl
          : null
        const catKey = program.categories?.[0] || 'ETC'
        const cat = CATEGORY[catKey] || CATEGORY.ETC

        // Day 65 본인 피드백: 프로그램 제목은 절대 줄바꿈 금지. 길이에 따라
        // 폰트 크기 자동 축소. 그래도 초과하면 ellipsis (... 표시).
        const titleLen = (program.name || '').length
        const titleSize =
          titleLen <= 10 ? 'text-xl sm:text-2xl' :
          titleLen <= 14 ? 'text-lg sm:text-xl' :
          titleLen <= 18 ? 'text-base sm:text-lg' :
          titleLen <= 22 ? 'text-sm sm:text-base' :
          'text-xs sm:text-sm'

        return (
          <div className="relative bg-white border border-gray-200 rounded-[10px] overflow-hidden mb-[6px] min-h-[108px]">
            {/* 배경 사진 — 좌측 일부 영역에만. ProgramCover 로 목록 카드와 동일 폴백
                (업로드사진 → 카테고리 일러스트 → 이모지). */}
            <div className="absolute inset-y-0 left-0 w-[38%]">
              <ProgramCover
                imagePath={program.cover_image_path}
                categories={program.categories}
                name={program.name}
                variant="hero"
                className="w-full h-full aspect-auto rounded-none"
              />
              {/* 사진 우측 끝에서 흰색으로 페이드 — 텍스트와 자연스럽게 연결 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-white" />
            </div>

            {/* 상태 배지 — 사진 위 좌상단 */}
            <span className={`absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md text-xs font-semibold ${statusCls}`}>
              {statusLabel}
            </span>

            {/* 텍스트 영역 — 우측 (사진 끝과 살짝 겹쳐 페이드 자연스럽게) */}
            <div className="relative z-10 pl-[calc(34%+15px)] pr-4 sm:pr-5 py-2.5 min-h-[108px] flex flex-col justify-center">
              <h1
                className={`${titleSize} font-bold text-gray-800 mb-1 leading-tight whitespace-nowrap overflow-hidden text-ellipsis`}
                title={program.name}
              >
                {program.name}
              </h1>
              {(program.start_date || program.end_date) && (
                <p className="text-xs sm:text-sm text-gray-600 mb-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                  <span className="text-gray-400">기간 </span>
                  {/* 넓은 화면: 연도 4자리 / 좁은 화면: 연도 2자리(26.06.11) — 줄바꿈 방지 */}
                  <span className="hidden sm:inline">{formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}</span>
                  <span className="sm:hidden">{formatKoreanDate(program.start_date).slice(2)} ~ {formatKoreanDate(program.end_date).slice(2)}</span>
                  {totalDays && <span className="text-gray-500"> ({totalDays}일)</span>}
                </p>
              )}
              {program.start_date && program.end_date && (
                <div className="mb-1.5">
                  <div className="flex items-center gap-2 pr-8">
                    <div className="flex-1 h-2 bg-white/70 rounded-full overflow-hidden border border-gray-100">
                      <div
                        className={`h-full rounded-full transition-all ${urgency.barCls || 'bg-emerald-400'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className={`text-sm font-semibold flex-shrink-0 ${urgency.textCls || 'text-emerald-600'}`}>
                      {urgency.label && `${urgency.urgency === 'ended' ? '🏁' : urgency.urgency === 'imminent' ? '🔥' : '⏳'} `}{progress}%
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600 flex-wrap">
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/programs/${id}/stats/users`)}
                    className="inline-flex items-center gap-1 hover:text-emerald-700 transition"
                    title="참여 유저 관리로 이동"
                  >
                    <UsersSolid className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-500">참여자</span>
                    <span className="text-gray-800 font-semibold underline underline-offset-2 decoration-gray-300">{ranking.length}명</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <UsersSolid className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-500">참여자</span>
                    <span className="text-gray-800 font-semibold">{ranking.length}명</span>
                  </span>
                )}
                {program.ranking_enabled !== false && myRank && (
                  <span className="inline-flex items-center gap-1">
                    <TrophySolid className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-gray-500">내 순위</span>
                    <span className="text-gray-800 font-semibold">{myRank}등</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* 열람 모드 배너 — 공개 프로그램 비참여자 */}
      {isViewer && (
        <div className="flex items-center gap-3 mb-[6px] p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <span className="text-xl flex-shrink-0">👀</span>
          <p className="flex-1 min-w-0 text-xs text-emerald-800 leading-snug">
            <span className="font-bold">둘러보는 중이에요.</span> 참여하면 인증·작성·랭킹 참여가 가능해요.
          </p>
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="flex-shrink-0 px-3 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-xs font-semibold rounded-full hover:from-emerald-500 hover:to-teal-600 transition"
          >
            참여 신청하기
          </button>
        </div>
      )}

      {/* 운영자 빠른 액션 — 초대(비공개) + 운영자 패널 (모달). 탭 위에 배치 */}
      {isOwner && (
        <div className="flex gap-2 mb-[6px]">
          {program.status === 'PUBLISHED' && program.join_type === 'INVITE_CODE' && program.invite_code && (
            <button
              type="button"
              onClick={() => setIsInviteOpen(true)}
              className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-white border border-emerald-200 rounded-2xl hover:bg-emerald-50 transition text-left"
            >
              <span className="text-lg flex-shrink-0">🎟️</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-800">초대</div>
                <div className="text-[11px] text-gray-500 break-keep">링크로 참여자 초대</div>
              </div>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsPanelOpen(true)}
            className="relative flex-1 flex items-center gap-2 px-3 py-2.5 bg-white border border-amber-200 rounded-2xl hover:bg-amber-50 transition text-left"
          >
            <span className="text-lg flex-shrink-0">⚙️</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-800">운영자 패널</div>
              <div className="text-[11px] text-gray-500 break-keep">관리 · 심사 · 통계</div>
            </div>
            {pendingCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center leading-none">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* 탭 바 — 개요/미션/퀴즈/커뮤니티/성장. 마지막 탭 라벨은 gamification_type 에 따라 분기.
          본인 결정 (Day 65): 정원/별자리도 「성장」 통합 라벨로 일원화. */}
      {(() => {
        const gType = program.gamification_type || (program.ranking_enabled !== false ? 'RANKING' : null)
        // 열람자에겐 개인 정원/별자리 대신 랭킹 목록 → 라벨도 '랭킹'
        const growthLabel = isViewer
          ? (gType ? '랭킹' : null)
          : gType === 'GARDEN' ? '성장' : gType === 'CONSTELLATION' ? '성장' : gType === 'RANKING' ? '랭킹' : null
        const tabs = [
          { key: 'overview', label: '개요' },
          { key: 'missions', label: '미션' },
          // 퀴즈는 참여 필요 — 열람자에겐 숨김
          ...(isViewer ? [] : [{ key: 'quizzes', label: '퀴즈' }]),
          { key: 'community', label: '커뮤니티' },
          ...(growthLabel ? [{ key: 'ranking', label: growthLabel }] : []),
        ]
        // 방어: 성장/랭킹 탭이 사라졌는데 현재 ranking 탭이면 overview 로 fallback
        const safeActiveTab = (activeTab === 'ranking' && !growthLabel)
          ? 'overview'
          : activeTab
        return (
          // 메뉴 선택 바 — 풀폭 언더라인 탭 (모서리 0)
          <div className="-mx-4 mb-[6px] border-b border-gray-100">
            <div className="max-w-4xl mx-auto flex">
              {tabs.map(tab => {
                const isActive = safeActiveTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative flex-1 h-[40px] text-[14px] transition-colors ${
                      isActive ? 'text-emerald-600 font-bold' : 'text-gray-400 font-semibold hover:text-gray-600'
                    }`}
                  >
                    {tab.label}
                    {isActive && (
                      <span className="absolute left-0 right-0 -bottom-px h-[2.5px] bg-emerald-500 rounded-full" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ─── 개요 탭 ────────────────────────────────────── */}
      {activeTab === 'overview' && (<>

      {/* 운영자 패널·초대 링크 → 탭 위 빠른 액션 박스 + 모달로 이동 (페이지 하단 모달 렌더) */}

      {/* ─── 모의도 콘텐츠 (Day 65 본인 결정, 상태 카드 제거 — 연속을 진행 현황으로 통합) ───
          1) 진행 현황 카드 (활동일/전체 + 참여율 + 누적P + 🔥연속 + 진행률 바)
          2) 오늘의 인증 미션 미리보기 (최대 3개)
          3) 최근 인증 기록 (최대 3개) */}

      {/* 1) 진행 현황 카드 */}
      {(() => {
        // 기간 계산 (start/end 없으면 안전 fallback)
        const startDate = program.start_date ? new Date(`${program.start_date}T00:00:00+09:00`) : null
        const endDate = program.end_date ? new Date(`${program.end_date}T00:00:00+09:00`) : null
        const today = new Date()
        const programDays = (startDate && endDate)
          ? Math.max(1, Math.round((endDate - startDate) / 86400000) + 1)
          : null
        const elapsedDays = startDate
          ? Math.min(programDays || 9999, Math.max(0, Math.round((today - startDate) / 86400000) + 1))
          : 0
        const remainingDays = (programDays && elapsedDays != null)
          ? Math.max(0, programDays - elapsedDays)
          : null
        const activeDays = overviewData?.activeDays ?? 0
        const participationRate = elapsedDays > 0
          ? Math.min(100, Math.round((activeDays / elapsedDays) * 100))
          : 0
        // 헤더 막대(calcProgress) 와 동일 계산식 사용 — 임계값 경계에서 두 막대가
        // 다른 단계로 보이는 시각 불일치 방지 (elapsedDays/programDays 는 일 단위
        // round 라 시간 정확도 떨어짐).
        const progressPct = calcProgress(program.start_date, program.end_date)
        const progressUrg = progressUrgency(progressPct)

        return (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-emerald-600 mb-3">나의 진행 현황</h3>
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div>
                <div className="flex items-center gap-0.5 text-xs font-semibold text-gray-600 mb-1 whitespace-nowrap">
                  <Calendar className="w-3 h-3 text-emerald-500" />
                  전체 진행
                </div>
                <p className="font-semibold text-gray-800 leading-tight">
                  <span className="text-lg sm:text-xl">{activeDays}</span>
                  <span className="text-xs text-gray-500">/{programDays || '-'}일</span>
                </p>
              </div>
              <div>
                <div className="flex items-center gap-0.5 text-xs font-semibold text-gray-600 mb-1 whitespace-nowrap">
                  <Activity className="w-3 h-3 text-emerald-500" />
                  참여율
                </div>
                <p className="text-lg sm:text-xl font-semibold text-gray-800 leading-tight">
                  {participationRate}<span className="text-xs">%</span>
                </p>
              </div>
              <div>
                <div className="flex items-center gap-0.5 text-xs font-semibold text-gray-600 mb-1 whitespace-nowrap">
                  <Award className="w-3 h-3 text-amber-500" />
                  획득 포인트
                </div>
                <p className="text-lg sm:text-xl font-semibold text-emerald-700 leading-tight">
                  +{scores.total}<span className="text-xs">P</span>
                </p>
              </div>
              <div>
                <div className="flex items-center gap-0.5 text-xs font-semibold text-gray-600 mb-1 whitespace-nowrap">
                  <Flame className="w-3 h-3 text-orange-500" />
                  연속
                </div>
                <p className="text-lg sm:text-xl font-semibold text-orange-600 leading-tight">
                  {overviewData?.streak ?? 0}<span className="text-xs">일</span>
                </p>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
              <div
                className={`h-full rounded-full transition-all ${progressUrg.barCls || 'bg-emerald-400'}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className={`text-xs ${progressUrg.textCls || 'text-gray-500'}`}>
              {progressUrg.urgency === 'ended'
                ? '🏁 프로그램이 종료되었어요'
                : progressUrg.urgency === 'imminent'
                  ? `🔥 마무리 임박 — ${remainingDays}일 남았어요. 끝까지 화이팅!`
                  : progressUrg.urgency === 'soon'
                    ? `⏳ 마무리 단계 — ${remainingDays}일 남았어요`
                    : remainingDays != null && remainingDays > 0
                      ? `목표까지 ${remainingDays}일 남았어요!`
                      : programDays && elapsedDays >= programDays
                        ? '프로그램이 종료되었어요'
                        : '진행 정보 없음'}
            </p>
          </div>
        )
      })()}

      {/* 📝 안내 (개요 글) — 진행 현황 바로 아래로 이동 (Day 65 본인 결정).
          프로그램 설명이 위쪽에 와야 사용자가 바로 봄.
          - 글 있으면: 모두에게 표시
          - 글 없는데 운영자: 작성 안내
          - 글 없고 참가자: 숨김 */}
      {(program.overview_content?.trim() || isOwner) && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">📝 안내</h2>
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsOverviewEditOpen(true)}
                className="inline-flex items-center gap-0.5 text-xs text-emerald-600 hover:text-emerald-700"
              >
                <Pencil className="w-3 h-3" />
                {program.overview_content?.trim() ? '수정' : '작성'}
              </button>
            )}
          </div>
          {program.overview_content?.trim() ? (
            <MarkdownView content={program.overview_content} />
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              ✏️ 우측 「작성」 을 눌러 프로그램 소개·공지를 작성해보세요
            </p>
          )}
        </div>
      )}

      {/* 참여자 자가 탈퇴 — 자동 승인(FREE) 프로그램 + ACTIVE 참여자 (비운영자).
          공개/비공개 무관 — 자유 참여한 프로그램은 자유롭게 나갈 수 있게. */}
      {!isOwner && isActiveParticipant && program.join_type === 'FREE' && (
        <div className="text-center mb-6">
          <button
            type="button"
            onClick={handleLeave}
            disabled={leaveMutation.isPending}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-red-500 transition disabled:opacity-50"
          >
            <DoorIcon className="w-6 h-6 text-red-500" />
            <span className="underline underline-offset-2">이 프로그램에서 나가기</span>
          </button>
        </div>
      )}

      </>)}
      {/* ─── /개요 탭 ──────────────────────────────────── */}

      {/* ─── 미션 탭 ────────────────────────────────────── */}
      {activeTab === 'missions' && (<>

      {/* 미션 목록 — 3개 + 전체보기 토글 + framer 부드러운 전환 */}
      <div ref={missionSectionRef} className="flex items-center justify-between mb-3 scroll-mt-16">
        <h2 className="text-lg font-semibold text-gray-800">📋 미션 목록</h2>
        <div className="flex items-center gap-2">
          {missionCards.length > 3 && (
            <button
              type="button"
              onClick={() => { setShowAllMissions(!showAllMissions); scrollToSection(missionSectionRef) }}
              className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700"
            >
              {showAllMissions ? '간단히 보기' : `전체보기 (${missionCards.length})`}
              {!showAllMissions && <ChevronRight className="w-3 h-3" />}
            </button>
          )}
          {isOwner && (
            <button
              type="button"
              onClick={() => setIsLibraryOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm rounded-full transition"
            >
              <Plus className="w-4 h-4" />
              미션 추가
            </button>
          )}
        </div>
      </div>
      {missions.length === 0 ? (
        <EmptyState icon="🎯" title="미션이 아직 없어요" />
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-3">
          <AnimatePresence initial={false}>
            {displayedMissionCards.map(card => {
              if (card.kind === 'solo') {
                const m = card.mission
                return (
                  <motion.div
                    key={`solo:${m.id}`}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  >
                    <MissionCard
                      mission={m}
                      todayCounts={todayCounts}
                      isOwner={isOwner}
                      isDeletePending={deleteMissionMutation.isPending}
                      onDelete={handleMissionDelete}
                      onEdit={(mission) => { setEditingMission(mission); setIsMissionCreateOpen(true) }}
                      programId={id}
                      viewerMode={isViewer}
                      onViewerAction={() => setJoinOpen(true)}
                    />
                  </motion.div>
                )
              }

              // 묶음 카드
              const group = card.group
              const totalPoint = group.missions.reduce((s, m) => s + (m.point || 0), 0)
              const bundleParam = encodeURIComponent(group.bundleTitle)

              return (
                <motion.button
                  key={`bundle:${group.bundleTitle}`}
                  type="button"
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  onClick={() => navigate(`/programs/${id}/bundles/${bundleParam}`)}
                  className="w-full flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-emerald-300 transition text-left"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800 truncate">{group.bundleTitle}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {group.missions.length}개 미션 · 총 {totalPoint}P
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </motion.button>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      </>)}
      {/* ─── /미션 탭 ──────────────────────────────────── */}

      {/* ─── 퀴즈 탭 ────────────────────────────────────── */}
      {activeTab === 'quizzes' && (<>

      {isOwner ? (
        <EmptyState
          icon="📝"
          title="퀴즈 관리는 게시물 관리에서"
          description="운영자 패널의 📋 게시물 관리에서 퀴즈를 생성·관리할 수 있어요"
          action={{ label: '게시물 관리로', onClick: () => navigate(`/programs/${id}/posts`) }}
        />
      ) : participantQuizzes.length === 0 ? (
        <EmptyState icon="📝" title="아직 풀 수 있는 퀴즈가 없어요" />
      ) : (
        <div ref={quizSectionRef} className="scroll-mt-16">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">📝 퀴즈</h2>
            {participantQuizzes.length > 3 && (
              <button
                type="button"
                onClick={() => { setShowAllQuizzes(!showAllQuizzes); scrollToSection(quizSectionRef) }}
                className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700"
              >
                {showAllQuizzes ? '간단히 보기' : `전체보기 (${participantQuizzes.length})`}
                {!showAllQuizzes && <ChevronRight className="w-3 h-3" />}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3">
            {(showAllQuizzes ? participantQuizzes : participantQuizzes.slice(0, 3)).map(quiz => {
              const sub = quiz.mySubmission
              const now = new Date()
              const isNotStarted = quiz.start_at && new Date(quiz.start_at) > now
              const isExpired = quiz.due_at && new Date(quiz.due_at) < now
              return (
                <button
                  key={quiz.id}
                  type="button"
                  onClick={() => navigate(`/programs/${id}/quiz/${quiz.id}`)}
                  className="w-full flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-emerald-300 transition text-left"
                >
                  <span className="text-2xl flex-shrink-0">📝</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800 truncate">{quiz.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {sub
                        ? (sub.status === 'PENDING' ? '채점 중' : `완료 · ${sub.total_score}점`)
                        : isNotStarted
                          ? `${formatKoreanDateTime(quiz.start_at)} 시작`
                          : isExpired
                            ? '마감됨'
                            : quiz.due_at ? `~ ${formatKoreanDateTime(quiz.due_at)}` : '미응시'}
                    </p>
                  </div>
                  {sub ? (
                    <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700 flex-shrink-0">완료</span>
                  ) : isNotStarted ? (
                    <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700 flex-shrink-0">예정</span>
                  ) : isExpired ? (
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500 flex-shrink-0">마감</span>
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      </>)}
      {/* ─── /퀴즈 탭 ──────────────────────────────────── */}

      {/* ─── 커뮤니티 탭 ────────────────────────────────── */}
      {/* 본인 결정 (Day 58): 진입 카드 제거 → 바로 피드 임베드. ProgramFeedPage 와 동일 컴포넌트 공유. */}
      {activeTab === 'community' && (<>

      {program.feed_enabled ? (
        <Suspense fallback={<LoadingState text="피드 불러오는 중..." />}>
          <FeedContent program={program} readOnly={isViewer} />
        </Suspense>
      ) : (
        <EmptyState
          icon="🔒"
          title="이 프로그램은 커뮤니티가 꺼져 있어요"
          description="운영자가 피드 옵션을 활성화하면 참여자들의 인증을 함께 볼 수 있어요"
        />
      )}

      </>)}
      {/* ─── /커뮤니티 탭 ──────────────────────────────── */}

      {/* ─── 성장 탭 (랭킹 / 정원 / 별자리 분기) ───────────────────── */}
      {activeTab === 'ranking' && !isViewer && (program.gamification_type === 'GARDEN') && (
        <GardenPanel
          participation={myParticipation}
          activeDays={overviewData?.activeDays || 0}
          totalCount={overviewData?.totalCount || 0}
          programDays={programDaysForGrowth}
          onPlantSeed={(position, flowerKey) => handlePlantSeed(position, flowerKey)}
          onUpdateGarden={handleUpdateGarden}
        />
      )}
      {activeTab === 'ranking' && !isViewer && (program.gamification_type === 'CONSTELLATION') && (
        <ConstellationPanel
          participation={myParticipation}
          activeDays={overviewData?.activeDays || 0}
          totalCount={overviewData?.totalCount || 0}
          programDays={programDaysForGrowth}
          onInitConstellation={(key) => handleInitConstellation(key)}
          onUpdateConstellation={handleUpdateConstellation}
        />
      )}

      {/* 랭킹 — gamification_type=RANKING (또는 legacy ranking_enabled=true) */}
      {activeTab === 'ranking'
        && (isViewer || program.gamification_type === 'RANKING' || (!program.gamification_type && program.ranking_enabled !== false))
        && (<>
      <h2 className="text-lg font-semibold text-gray-800 mb-3">🏆 랭킹</h2>

      {/* 기간 필터 — period_filter_enabled 옵션 시 (전체/7일/30일) */}
      {periodFilterVisible && (
        <div className="flex gap-1 p-1 bg-gray-100 rounded-pill mb-3">
          {PERIOD_OPTIONS.map(opt => {
            const isActive = opt.value === period
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriod(opt.value)}
                className={`flex-1 py-2 text-sm font-medium rounded-pill transition ${isActive ? 'bg-white text-brand-deep shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {/* 추세 — trend_enabled 옵션 시 본인 14일 sparkline (라벨 카드로 맥락 부여) */}
      {trendVisible && myScoreSeries.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-white border border-gray-100 rounded-card shadow-soft px-4 py-3 mb-4">
          <span className="text-sm font-semibold text-gray-700">📈 내 14일 점수 추세</span>
          <ScoreSparkline series={myScoreSeries} />
        </div>
      )}

      {/* 시상대 — podium_enabled + 3명 이상일 때만 콘텐츠 상단 */}
      {hasPodium && (
        <div className="mb-4">
          <PodiumTop3 top3={podiumTop3} userId={userId} />
        </div>
      )}

      {ranking.length === 0 ? (
        <EmptyState icon="👥" title="아직 참여자가 없어요" size="sm" />
      ) : restRanking.length === 0 ? (
        null
      ) : (() => {
        const RANK_PAGE = 10
        const hasMore = restRanking.length > RANK_PAGE
        const displayed = showAllRanking ? restRanking : restRanking.slice(0, RANK_PAGE)
        return (
          <>
            <div className="relative">
              <div className="grid gap-2">
                {displayed.map(row => {
                  const isMe = row.user_id === userId
                  const rankBadgeClass =
                    row.rank === 1 ? 'bg-yellow-100 text-yellow-700'
                    : row.rank === 2 ? 'bg-gray-200 text-gray-700'
                    : row.rank === 3 ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-50 text-gray-500'

                  return (
                    <div
                      key={row.user_id}
                      className={`
                        flex items-center justify-between p-3 rounded-2xl border
                        ${isMe ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200'}
                      `}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`
                          flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium flex-shrink-0
                          ${rankBadgeClass}
                        `}>
                          {row.rank}
                        </span>
                        <UserAvatar avatarPath={row.avatar_path} nickname={row.nickname} size="md" />
                        <span className={`font-medium truncate ${isMe ? 'text-emerald-800' : 'text-gray-800'}`}>
                          {row.nickname}
                          {isMe && <span className="ml-1 text-xs text-emerald-600">(나)</span>}
                        </span>
                      </div>
                      <span className={`text-sm font-medium ${isMe ? 'text-emerald-700' : 'text-gray-600'}`}>
                        {row.total_score}P
                      </span>
                    </div>
                  )
                })}
              </div>
              {/* 페이드 오버레이 — 미펼침 + 더 있을 때만 (마지막 ~2 카드 점진 흐림) */}
              {!showAllRanking && hasMore && (
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none rounded-b-2xl" />
              )}
            </div>
            {/* 더보기 버튼 */}
            {hasMore && (
              <div className="flex justify-center mt-3">
                <button
                  type="button"
                  onClick={() => setShowAllRanking(!showAllRanking)}
                  className="px-12 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-full border border-emerald-200 transition"
                >
                  {showAllRanking ? '간단히 보기' : `더보기 (${restRanking.length}명)`}
                </button>
              </div>
            )}
          </>
        )
      })()}
      </>)}

      {/* 모달들 — lazy + 조건부 렌더. isOpen=true 되는 순간만 chunk 다운로드 */}
      <Suspense fallback={null}>
        {joinOpen && (
          <ProgramDetailModal
            program={program}
            isOpen={true}
            onClose={() => {
              setJoinOpen(false)
              queryClient.invalidateQueries({ queryKey: ['my-part-status', id, userId] })
              queryClient.invalidateQueries({ queryKey: queryKeys.activePrograms(userId) })
            }}
          />
        )}
        {isApprovalsOpen && (
          <ParticipantApprovalModal
            programId={id}
            isOpen={true}
            onClose={() => setIsApprovalsOpen(false)}
          />
        )}
        {isEditOpen && (
          <ProgramEditModal
            program={program}
            isOpen={true}
            onClose={() => setIsEditOpen(false)}
            onSuccess={invalidateProgramData}
          />
        )}
        {isOverviewEditOpen && (
          <OverviewEditModal
            program={program}
            isOpen={true}
            onClose={() => setIsOverviewEditOpen(false)}
            onSuccess={invalidateProgramData}
          />
        )}
        {isLibraryOpen && (
          <MissionLibraryModal
            program={program}
            isOpen={true}
            onClose={() => setIsLibraryOpen(false)}
            onSuccess={() => { invalidateProgramData(); setShowAllMissions(true) }}
            onCustomCreate={() => {
              setIsLibraryOpen(false)
              setIsMissionCreateOpen(true)
            }}
          />
        )}
        {isMissionCreateOpen && (
          <MissionCreateModal
            program={program}
            isOpen={true}
            editMission={editingMission}
            onClose={() => { setIsMissionCreateOpen(false); setEditingMission(null) }}
            onSuccess={() => { invalidateProgramData(); setShowAllMissions(true) }}
            onBack={editingMission ? undefined : () => { setIsMissionCreateOpen(false); setIsLibraryOpen(true) }}
          />
        )}
        {isInviteOpen && program.invite_code && (
          <InviteModal
            code={program.invite_code}
            isOpen={true}
            onClose={() => setIsInviteOpen(false)}
          />
        )}
      </Suspense>

      {/* 운영자 패널 모달 — 탭 위 「운영자 패널」 박스에서 진입 */}
      {isOwner && (
        <Modal isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)}>
          <div className="p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">⚙️ 운영자 패널</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setIsPanelOpen(false); setIsOverviewEditOpen(true) }}
                className="col-span-2 px-3 py-2 bg-white border border-amber-300 hover:border-amber-500 hover:bg-amber-100 rounded text-sm text-amber-800 transition text-left"
              >
                📝 개요 글 {program.overview_content?.trim() ? '수정' : '작성'}
                <span className="block text-xs text-amber-700 break-keep">
                  {program.overview_content?.trim() ? '참여자에게 보이는 안내 글 수정' : '프로그램 소개·공지를 마크다운으로 작성'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setIsPanelOpen(false); setIsEditOpen(true) }}
                className="px-3 py-2 bg-white border border-amber-300 hover:border-amber-500 hover:bg-amber-100 rounded text-sm text-amber-800 transition text-left"
              >
                ✏️ 프로그램 수정
                <span className="block text-xs text-amber-700 break-keep">이름·기간·카테고리</span>
              </button>
              <button
                type="button"
                onClick={() => { setIsPanelOpen(false); navigate(`/programs/${id}/posts`) }}
                className="px-3 py-2 bg-white border border-amber-300 hover:border-amber-500 hover:bg-amber-100 rounded text-sm text-amber-800 transition text-left"
              >
                📋 게시물 관리
                <span className="block text-xs text-amber-700 break-keep">퀴즈 생성·관리</span>
              </button>
              <button
                type="button"
                onClick={() => { setIsPanelOpen(false); navigate(`/programs/${id}/reviews`) }}
                className="px-3 py-2 bg-white border border-amber-300 hover:border-amber-500 hover:bg-amber-100 rounded text-sm text-amber-800 transition text-left"
              >
                ✅ 미션 인증 심사
                <span className="block text-xs text-amber-700 break-keep">MANUAL 미션 승인/반려</span>
              </button>
              <button
                type="button"
                onClick={() => { setIsPanelOpen(false); setIsApprovalsOpen(true) }}
                className="relative px-3 py-2 bg-white border border-amber-300 hover:border-amber-500 hover:bg-amber-100 rounded text-sm text-amber-800 transition text-left"
              >
                🙋 참여자 승인 심사
                <span className="block text-xs text-amber-700 break-keep">신청자 답변 확인 · 승인/거절</span>
                {pendingCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center leading-none">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setIsPanelOpen(false); navigate(`/programs/${id}/stats`) }}
                className="px-3 py-2 bg-white border border-amber-300 hover:border-amber-500 hover:bg-amber-100 rounded text-sm text-amber-800 transition text-left"
              >
                📊 참여자 통계
                <span className="block text-xs text-amber-700 break-keep">참여 · 인증 · 미션별 현황</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default ProgramDetailPage
