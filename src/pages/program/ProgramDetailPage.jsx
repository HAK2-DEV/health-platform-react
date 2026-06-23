import { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { ChevronLeft, Plus, ChevronRight, Users, Trophy, Pencil, Calendar, Activity, Award, Flame, Check, Settings } from 'lucide-react'
import DoorIcon from '../../components/common/DoorIcon'
import { supabase } from '../../supabaseClient'
import { CATEGORY } from '../../lib/constants'
import { formatKoreanDate, formatKoreanDateTime, isUpcomingByStartDate, formatRelativeKstDay } from '../../lib/formatters'
import MissionCard from '../../components/program/MissionCard'
import GardenPanel from '../../components/program/GardenPanel'
import ConstellationPanel from '../../components/program/ConstellationPanel'
import PodiumTop3 from '../../components/program/PodiumTop3'
import ScoreSparkline from '../../components/program/ScoreSparkline'
import StickyBackBar from '../../components/common/StickyBackBar'
import Modal from '../../components/common/Modal'
import DeleteProgramModal from '../../components/program/DeleteProgramModal'
import ProfileButton from '../../components/common/ProfileButton'
import NotificationBell from '../../components/common/NotificationBell'
import UserAvatar from '../../components/common/UserAvatar'
import EmptyState from '../../components/common/EmptyState'
import LoadingState from '../../components/common/LoadingState'
import ProgramCover from '../../components/common/ProgramCover'
import OverviewManagePanel from '../../components/program/OverviewManagePanel'
import MissionManagePanel from '../../components/program/MissionManagePanel'
import QuizManagePanel from '../../components/program/QuizManagePanel'
import QuizLibraryModal from '../../components/program/QuizLibraryModal'
import CommunityManagePanel from '../../components/program/CommunityManagePanel'
import CommunityPostModal from '../../components/program/CommunityPostModal'
import CommunityPostList from '../../components/program/CommunityPostList'
import CommunityReviewModal from '../../components/program/CommunityReviewModal'
import ReportsManageSection from '../../components/program/ReportsManageSection'
import HiddenPostsSection from '../../components/program/HiddenPostsSection'
import VerificationReviewModal from '../../components/program/VerificationReviewModal'
import MarkdownView from '../../components/common/MarkdownView'
import ConfirmModal from '../../components/common/ConfirmModal'
import RankingSettingsModal from '../../components/program/RankingSettingsModal'
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
  fetchProgramQuizzes,
  duplicateQuiz,
  fetchCommunityPosts,
  fetchCommunityPendingPosts,
  fetchPendingReviews,
  fetchProgramOverview,
  fetchUnresolvedReportCount,
  fetchMetricTotals,
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

// 운영자 메뉴 시트 — 항목 박스 (아이콘 + 제목 + 설명, 우측 화살표/배지)
function PanelMenuBox({ icon, title, desc, onClick, chevron = false, badge = 0, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full flex items-center gap-3 px-4 py-3.5 bg-white border rounded-2xl transition text-left ${
        danger ? 'border-red-200 hover:border-red-400 hover:bg-red-50/50' : 'border-gray-200 hover:border-amber-400 hover:bg-amber-50/50'
      }`}
    >
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-[15px] font-bold ${danger ? 'text-red-600' : 'text-gray-800'}`}>{title}</p>
        {desc && <p className="text-[12px] text-gray-500 mt-0.5 break-keep">{desc}</p>}
      </div>
      {badge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center leading-none flex-shrink-0">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {chevron && <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />}
    </button>
  )
}

function ProgramDetailPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)   // 프로그램 삭제 2단계 확인 모달
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
  const opPanelRef = useRef(null)  // 운영자 빠른 액션 박스 — 개요 관리자 열 때 상단으로 스크롤
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

  const { data: missionsRaw = [] } = useQuery({
    queryKey: queryKeys.programMissions(id),
    queryFn: () => fetchProgramMissions(id),
    enabled: !!session && !!id,
  })
  // sort_order(092) 우선, 없으면 created_at — 컬럼 미적용 시에도 안전(하위호환)
  const missions = useMemo(() => {
    return [...missionsRaw].sort((a, b) =>
      ((a.sort_order ?? 1e9) - (b.sort_order ?? 1e9)) ||
      (new Date(a.created_at) - new Date(b.created_at))
    )
  }, [missionsRaw])

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

  // 추세 sparkline — 「본인 14일 점수 추세」기능 비활성화 (2026-06-21, 랭킹 UI 정리).
  //   표시·fetch 모두 중단. (재도입 시 !!program?.trend_enabled 로 복구)
  const trendVisible = false
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

  // 운영자용 퀴즈 목록 (퀴즈 관리자 작업 페이지)
  const { data: programQuizzes = [] } = useQuery({
    queryKey: queryKeys.programQuizzes(id),
    queryFn: () => fetchProgramQuizzes(id),
    enabled: !!session && !!id && !!program && isOwner,
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
  // 가입 승인 요청 알림(?approvals=1)으로 진입하면 「참여 승인 심사」 모달 자동 오픈 (최초 1회)
  useEffect(() => {
    if (searchParams.get('approvals') === '1') {
      setIsApprovalsOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('approvals')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [panelView, setPanelView] = useState('root')   // 운영자 메뉴 시트 단계: root | settings | menubar
  const [isRankingOpen, setIsRankingOpen] = useState(false)  // 랭킹 설정 모달
  const closePanel = () => { setIsPanelOpen(false); setPanelView('root') }
  const handleRankingClose = () => { setIsRankingOpen(false); setPanelView('menubar'); setIsPanelOpen(true) }
  const [overviewManageOpen, setOverviewManageOpen] = useState(false)  // 개요 관리자 인라인 패널
  const [missionManageOpen, setMissionManageOpen] = useState(false)    // 미션 관리자 작업 페이지
  const [missionPreview, setMissionPreview] = useState(false)
  const quizManageOpen = searchParams.get('panel') === 'quiz'          // 퀴즈 관리자 — URL 유지(새 퀴즈/편집 후 뒤로가기 복원)
  const [quizPreview, setQuizPreview] = useState(false)
  const [communityManageOpen, setCommunityManageOpen] = useState(false) // 커뮤니티 관리자 작업 페이지
  const communityManageRef = useRef(null)
  // 참여자 커뮤니티 — 선택 게시판 칩. 알림 딥링크(?board=)면 그 게시판으로 시작.
  const [communityBoard, setCommunityBoard] = useState(() => searchParams.get('board') || 'all')
  // 댓글 알림 딥링크 — ?post= 가 있으면 CommunityPostList 가 그 글 상세를 자동 오픈
  //   ?c= 가 있으면 그 댓글로 스크롤·하이라이트
  const focusPostId = searchParams.get('post')
  const focusCommentId = searchParams.get('c')
  const clearFocusPost = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('post')
    next.delete('c')
    setSearchParams(next, { replace: true })
  }
  // 글 보러가기(?post=&board=) 딥링크 — 운영자 관리자 패널이 열린 상태에서 진입해도
  //   패널을 닫고 해당 게시판으로 전환해야 글 목록/상세(CommunityPostList)가 보인다.
  useEffect(() => {
    if (!focusPostId) return
    setCommunityManageOpen(false)
    const b = searchParams.get('board')
    if (b) setCommunityBoard(b)
  }, [focusPostId]) // eslint-disable-line react-hooks/exhaustive-deps
  const [isPostModalOpen, setIsPostModalOpen] = useState(false)         // 게시판 글쓰기 모달
  const [editingPost, setEditingPost] = useState(null)                 // 수정 중인 게시글 (null=새 글)

  // 게시판 글 (인증/전체 외 게시판) — 선택 칩 기준
  const { data: communityPosts = [], isLoading: isCommunityLoading } = useQuery({
    queryKey: queryKeys.communityPosts(id, communityBoard),
    queryFn: () => fetchCommunityPosts(id, communityBoard),
    enabled: !!session && !!id && !!program && activeTab === 'community' && communityBoard !== 'all' && communityBoard !== 'cert',
    staleTime: 60_000,          // 칩 전환 후 재진입 시 캐시 즉시 표시 (1분간 재요청 X → 깜빡임 없음)
  })
  // 공지 배너 — 공지 게시판 최신글 (공지 사용 ON 일 때)
  const { data: noticePosts = [] } = useQuery({
    queryKey: queryKeys.communityPosts(id, 'notice'),
    queryFn: () => fetchCommunityPosts(id, 'notice'),
    enabled: !!session && !!id && !!program && activeTab === 'community' && !!program?.feed_enabled
      && (program?.community_settings?.noticeEnabled !== false),
  })
  // 운영자 — 검토 대기 글 전체(통합 검토함 + 칩 배지). 게시판별 수는 여기서 파생.
  const { data: pendingPosts = [] } = useQuery({
    queryKey: queryKeys.communityPending(id),
    queryFn: () => fetchCommunityPendingPosts(id),
    enabled: !!session && !!id && !!program && isOwner && activeTab === 'community',
  })
  const communityPendingCounts = useMemo(() => {
    const m = {}
    for (const p of pendingPosts) m[p.board_id] = (m[p.board_id] || 0) + 1
    return m
  }, [pendingPosts])
  const [reviewOpen, setReviewOpen] = useState(false)   // 커뮤니티 통합 검토함 모달
  // 검토 대기 알림(?review=1) 으로 진입하면 통합 검토함 자동 오픈 (최초 1회)
  useEffect(() => {
    if (searchParams.get('review') === '1') {
      setReviewOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('review')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 운영자 — 검토 필요(PENDING_REVIEW) 인증 큐 + 「새 인증」 알림(?vreview=1) 진입 시 자동 오픈
  const { data: pendingReviews = [] } = useQuery({
    queryKey: queryKeys.pendingReviews(id),
    queryFn: () => fetchPendingReviews(id),
    enabled: !!session && !!id && !!program && isOwner,
  })
  // 운영자 메뉴 「신고 관리」 배지 — 미처리 신고가 있는 콘텐츠 수
  const { data: unresolvedReportCount = 0 } = useQuery({
    queryKey: ['reportsUnresolvedCount', id],
    queryFn: () => fetchUnresolvedReportCount(id),
    enabled: !!session && !!id && !!program && isOwner && program?.community_enabled !== false,
  })
  // 누적 지표 (121) — 단위별 함께/내 누적 (개요 카드)
  const { data: metricTotals = [] } = useQuery({
    queryKey: ['metricTotals', id],
    queryFn: () => fetchMetricTotals(id),
    enabled: !!session && !!id && !!program,
  })
  const [vreviewOpen, setVreviewOpen] = useState(false)
  useEffect(() => {
    if (searchParams.get('vreview') === '1') {
      setVreviewOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('vreview')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [quizLibOpen, setQuizLibOpen] = useState(false)                // 퀴즈 라이브러리 모달
  // 라이브러리에서 생성폼 진입 시 ?quizlib= 저장 → 폼에서 뒤로가기로 복귀하면 모달 재오픈 (PostsManagePage 패턴)
  const isQuizLibOpen = quizLibOpen || !!searchParams.get('quizlib')
  const closeQuizLib = () => {
    setQuizLibOpen(false)
    if (searchParams.get('quizlib')) {
      setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('quizlib'); return n }, { replace: true })
    }
  }

  const [overviewPreview, setOverviewPreview] = useState(false)  // 개요 관리자 — 참여자 화면 미리보기
  const [panelSaving, setPanelSaving] = useState(false)
  const [panelError, setPanelError] = useState(null)
  const [managedCover, setManagedCover] = useState(undefined)  // 개요 편집 중 표지(저장 전에도 프로필 카드/미리보기에 즉시 반영). undefined=변경 없음
  const managePanelRef = useRef(null)

  // 개요 관리자 열면 운영자 패널 버튼이 헤더 바로 아래로 오도록 스크롤 (프로필 카드 가림 → 편집 공간 확보)
  useEffect(() => {
    if (overviewManageOpen) {
      requestAnimationFrame(() => requestAnimationFrame(() => opPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })))
    } else {
      setOverviewPreview(false)
      setPanelError(null)
      setManagedCover(undefined)
    }
  }, [overviewManageOpen])

  // 미리보기 토글 — 진입 시 스크롤 위치 저장, 복귀 시 그 위치로 복원 (편집 중이던 자리 유지)
  const previewScrollRef = useRef(0)
  const toggleOverviewPreview = () => {
    setOverviewPreview(prev => {
      if (!prev) {
        previewScrollRef.current = window.scrollY
        return true
      }
      const y = previewScrollRef.current
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)))
      return false
    })
  }

  // 개요 관리자 열기/닫기 — 열기 전 스크롤 저장 → 닫을 때 원래 화면으로 복원
  const preOpenScrollRef = useRef(0)
  // 메뉴에서 관리자 진입 시 직전 탭 기억 → 닫을 때 그 탭으로 복귀
  const preManagerTabRef = useRef(null)
  // 메뉴에서 관리자 진입 시 닫으면 돌아갈 메뉴 단계(예: 'menubar') 기억
  const returnMenuViewRef = useRef(null)
  // 프로그램 설정 모달(ProgramEditModal) 닫힘 후 돌아갈 메뉴 단계
  const editReturnViewRef = useRef(null)
  const handleEditModalClose = () => {
    setIsEditOpen(false)
    const v = editReturnViewRef.current
    editReturnViewRef.current = null
    if (v) { setPanelView(v); setIsPanelOpen(true) }
  }
  const restorePreManagerTab = () => {
    if (preManagerTabRef.current != null) {
      setActiveTab(preManagerTabRef.current)
      preManagerTabRef.current = null
    }
  }
  // 관리자 닫힘 후처리 — 직전 탭 복원 + (메뉴 진입이었다면) 그 메뉴 단계로 재진입
  const afterManagerClose = () => {
    restorePreManagerTab()
    if (returnMenuViewRef.current) {
      const view = returnMenuViewRef.current
      returnMenuViewRef.current = null
      setPanelView(view)
      setIsPanelOpen(true)
    }
  }
  const openOverviewManage = () => {
    preOpenScrollRef.current = window.scrollY
    setOverviewManageOpen(true)
  }
  const closeOverviewManage = () => {
    setOverviewManageOpen(false)
    afterManagerClose()
    const y = preOpenScrollRef.current
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)))
  }

  // 미션 관리자 — 동일 패턴 (열 때 상단 스크롤, 닫을 때 복원, 미리보기 토글)
  useEffect(() => {
    if (missionManageOpen) requestAnimationFrame(() => requestAnimationFrame(() => opPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })))
    else setMissionPreview(false)
  }, [missionManageOpen])
  const openMissionManage = () => {
    preOpenScrollRef.current = window.scrollY
    setMissionManageOpen(true)
  }
  const closeMissionManage = () => {
    setMissionManageOpen(false)
    afterManagerClose()
    const y = preOpenScrollRef.current
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)))
  }
  const toggleMissionPreview = () => {
    setMissionPreview(prev => {
      if (!prev) { previewScrollRef.current = window.scrollY; return true }
      const y = previewScrollRef.current
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)))
      return false
    })
  }

  // 퀴즈 관리자 — 동일 패턴
  useEffect(() => {
    if (quizManageOpen) requestAnimationFrame(() => requestAnimationFrame(() => opPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })))
    else setQuizPreview(false)
  }, [quizManageOpen])
  const openQuizManage = () => {
    preOpenScrollRef.current = window.scrollY
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('tab', 'quizzes'); n.set('panel', 'quiz'); return n }, { replace: true })
  }
  const closeQuizManage = () => {
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('panel'); return n }, { replace: true })
    afterManagerClose()
    const y = preOpenScrollRef.current
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)))
  }
  const toggleQuizPreview = () => {
    setQuizPreview(prev => {
      if (!prev) { previewScrollRef.current = window.scrollY; return true }
      const y = previewScrollRef.current
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)))
      return false
    })
  }
  // 퀴즈 삭제 (제출·점수 CASCADE)
  const deleteQuizMutation = useMutation({
    mutationFn: async (quizId) => {
      const { error } = await supabase.from('quizzes').delete().eq('id', quizId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programQuizzes(id) })
      queryClient.invalidateQueries({ queryKey: ['scores'] })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      setQuizToDelete(null)
    },
    onError: (e) => { console.error('퀴즈 삭제 실패:', e); alert(`퀴즈 삭제에 실패했습니다: ${e.message}`) },
  })
  const [quizToDelete, setQuizToDelete] = useState(null)
  const handleQuizDelete = (q) => setQuizToDelete(q)

  // 프로그램 삭제 — owner 만(RLS), CASCADE 로 미션·퀴즈·참여자·인증·점수·게시물 연쇄 삭제.
  const deleteProgramMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('programs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.activePrograms(userId) })
      setIsDeleteOpen(false)
      navigate('/', { replace: true })
    },
    onError: (e) => { console.error('프로그램 삭제 실패:', e); alert(`프로그램 삭제에 실패했습니다: ${e.message}`) },
  })

  // 퀴즈 복제 — 원본 + 문항 복사한 새 퀴즈 생성 (일정 비움)
  const duplicateQuizMutation = useMutation({
    mutationFn: (q) => duplicateQuiz({ quizId: q.id, programId: id, userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programQuizzes(id) })
    },
    onError: (e) => { console.error('퀴즈 복제 실패:', e); alert(`퀴즈 복제에 실패했습니다: ${e.message}`) },
  })

  // 통계 등 별도 페이지에서 돌아오며 ?opmenu= 를 달고 오면 운영자 메뉴 시트를 그 단계로 재오픈
  useEffect(() => {
    const om = searchParams.get('opmenu')
    if (!om) return
    setPanelView(['root', 'settings', 'menubar'].includes(om) ? om : 'root')
    setIsPanelOpen(true)
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('opmenu'); return n }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // 사용 OFF 된 메뉴 탭이 URL(activeTab)로 열려 있으면 개요로 정규화 (콘텐츠가 activeTab 기반)
  useEffect(() => {
    if (!program) return
    if (activeTab === 'quizzes' && program.quiz_enabled === false) setActiveTab('overview')
    else if (activeTab === 'community' && program.community_enabled === false) setActiveTab('overview')
    else if (activeTab === 'ranking' && program.ranking_enabled === false) setActiveTab('overview')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, activeTab])

  // 커뮤니티 관리자 — 동일 패턴 (열 때 상단 스크롤, 닫을 때 복원)
  useEffect(() => {
    if (communityManageOpen) requestAnimationFrame(() => requestAnimationFrame(() => opPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })))
  }, [communityManageOpen])
  const openCommunityManage = () => { preOpenScrollRef.current = window.scrollY; setCommunityManageOpen(true) }
  const closeCommunityManage = () => {
    setCommunityManageOpen(false)
    afterManagerClose()
    const y = preOpenScrollRef.current
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)))
  }
  const handleCommunitySave = async () => {
    setPanelError(null); setPanelSaving(true)
    const err = await communityManageRef.current?.save()
    setPanelSaving(false)
    if (err) { setPanelError(err); return }
    closeCommunityManage()
  }

  // 부모 저장 바 → 패널 ref.save() 호출
  const handleOverviewSave = async (close) => {
    setPanelError(null)
    setPanelSaving(true)
    const err = await managePanelRef.current?.save()
    setPanelSaving(false)
    if (err) { setPanelError(err); return }
    if (close) closeOverviewManage()
  }

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
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const handleLeave = () => setLeaveConfirmOpen(true)

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
      setMissionToDelete(null)
    },
    onError: (err) => {
      console.error('미션 삭제 실패:', err)
      alert(`미션 삭제에 실패했습니다: ${err.message}`)
    },
  })

  const [missionToDelete, setMissionToDelete] = useState(null)
  const handleMissionDelete = (mission) => setMissionToDelete(mission)

  // 미션 복제 — 모든 컬럼 복사(인증/점수는 미포함) + 제목에 (복사)
  const duplicateMissionMutation = useMutation({
    mutationFn: async (mission) => {
      const { id: _id, created_at, updated_at, ...rest } = mission
      const { error } = await supabase.from('missions').insert({ ...rest, title: `${mission.title} (복사)` })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programMissions(id) })
      queryClient.invalidateQueries({ queryKey: ['missions', 'today'] })
    },
    onError: (err) => {
      console.error('미션 복제 실패:', err)
      alert(`미션 복제에 실패했습니다: ${err.message}`)
    },
  })
  const handleMissionDuplicate = (mission) => duplicateMissionMutation.mutate(mission)

  // 미션 순서 변경 — 새 순서대로 전체 미션에 sort_order 0,1,2... 재할당
  const reorderMissionMutation = useMutation({
    mutationFn: async (orderedIds) => {
      await Promise.all(orderedIds.map((mid, idx) =>
        supabase.from('missions').update({ sort_order: idx }).eq('id', mid)
      ))
    },
    onMutate: async (orderedIds) => {
      // 낙관적 업데이트 — 즉시 순서 반영 (깜빡임 방지)
      await queryClient.cancelQueries({ queryKey: queryKeys.programMissions(id) })
      const prev = queryClient.getQueryData(queryKeys.programMissions(id))
      if (prev) {
        const pos = new Map(orderedIds.map((mid, idx) => [mid, idx]))
        queryClient.setQueryData(queryKeys.programMissions(id),
          prev.map(m => ({ ...m, sort_order: pos.has(m.id) ? pos.get(m.id) : m.sort_order })))
      }
      return { prev }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.programMissions(id), ctx.prev)
      console.error('미션 순서 변경 실패:', err)
      alert(`순서 변경에 실패했습니다: ${err.message}`)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.programMissions(id) }),
  })
  const handleMissionReorder = (orderedIds) => reorderMissionMutation.mutate(orderedIds)

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
      <div className="px-[11px] pt-2 pb-6 max-w-4xl mx-auto">
        <StickyBackBar fallbackPath="/programs" title="둘러보기로" />
        <div className="text-center py-16">
          <div className="text-5xl mb-3 leading-none">🔒</div>
          <p className="text-lg font-bold text-gray-800 mb-1">비공개 프로그램이에요</p>
          <p className="text-sm text-gray-500">초대·링크로 참여한 회원만 볼 수 있어요.</p>
        </div>
      </div>
    )
  }

  // 인라인 관리자(개요/미션/퀴즈/커뮤니티)가 열린 상태 — 프로그램 프로필·탭 바 숨김(집중 편집 화면)
  const inManager = overviewManageOpen || missionManageOpen || quizManageOpen || communityManageOpen
  // 헤더 뒤로 — 관리자 열려 있으면 그 관리자를 닫고(탭 화면 복귀), 아니면 이전 화면
  const handleHeaderBack = () => {
    if (overviewManageOpen) return closeOverviewManage()
    if (missionManageOpen) return closeMissionManage()
    if (quizManageOpen) return closeQuizManage()
    if (communityManageOpen) return closeCommunityManage()
    navigate(-1)
  }
  const canInvite = program.status === 'PUBLISHED' && program.join_type === 'INVITE_CODE' && program.invite_code
  // 메뉴바 사용 토글(102) — 컬럼 없으면(마이그레이션 전) 사용으로 간주
  const quizEnabled = program.quiz_enabled !== false
  const communityEnabled = program.community_enabled !== false
  // 운영자 메뉴 시트 「내 프로그램 설정」 → 각 설정 클릭 시 탭 전환 + 인라인 관리자 열기
  const openManagerFromMenu = (key) => {
    closePanel()
    if (key === 'ranking') { setIsRankingOpen(true); return }   // 랭킹 전용 설정 모달, 닫으면 메뉴바로
    preManagerTabRef.current = activeTab                         // 닫을 때 직전 탭으로 복귀
    returnMenuViewRef.current = 'menubar'                        // 닫으면 「메뉴바 설정」으로 재진입
    if (key === 'overview') { setActiveTab('overview'); openOverviewManage() }
    else if (key === 'missions') { setActiveTab('missions'); openMissionManage() }
    else if (key === 'quizzes') { openQuizManage() }            // openQuizManage 가 tab=quizzes 까지 설정
    else if (key === 'community') { setActiveTab('community'); openCommunityManage() }
  }

  // 상태 배지(진행중/예정/임시저장) — 헤더 제목 옆 + (프로필 카드에서 이전됨)
  const hdrPublished = program.status === 'PUBLISHED'
  const hdrUpcoming = hdrPublished && isUpcomingByStartDate(program.start_date)
  const hdrDraft = program.status === 'DRAFT'
  const hdrStatusLabel = hdrDraft ? '임시저장' : hdrPublished ? (hdrUpcoming ? '예정' : '진행중') : program.status
  const hdrStatusCls = hdrDraft
    ? 'bg-gray-500 text-white'
    : (hdrPublished && !hdrUpcoming) ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'

  // 커뮤니티 게시판 칩 — 운영자 설정(community_settings.boards) 순서대로. 미설정 시 기본 4종.
  const communityBoards = (program.community_settings?.boards?.length
    ? program.community_settings.boards
    : [{ id: 'all', name: '전체' }, { id: 'notice', name: '공지' }, { id: 'cert', name: '인증' }, { id: 'free', name: '자유' }])
  const BOARD_ICON = { notice: '📢', cert: '📷', free: '💬' }
  // 전체/인증 = 미션 인증 피드, 그 외 = 게시판 글(community_posts)
  const boardHasFeed = communityBoard === 'all' || communityBoard === 'cert'
  // 현재 게시판의 실효 레이아웃 — 게시판별 override(boards[].layout) 우선, 없으면 프로그램 전체
  const activeBoardObj = communityBoards.find(b => b.id === communityBoard)
  const activeBoardLayout = activeBoardObj?.layout || program.community_layout || 'feed'
  // 좋아요/댓글 가능 여부 — 「반응 허용」 + 참여자/운영자(둘러보기 제외). 댓글은 commentPerm 도 따름.
  const reactionsEnabled = program.community_settings?.reactionAuto !== false
  const canReact = reactionsEnabled && (isOwner || isActiveParticipant)
  const canComment = canReact && (activeBoardObj?.commentPerm || 'free') !== 'readonly'
  // 작성 가능 게시판 — 전체/인증 제외, 참여자는 읽기전용 제외(운영자는 전부)
  const writableBoards = communityBoards.filter(b => {
    if (b.id === 'all' || b.id === 'cert') return false
    if (isOwner) return true
    return (b.writePerm || 'free') !== 'readonly'
  })
  // 공지 배너 — 공지 사용 ON + 최신 노출 공지 존재 + 공지 탭이 아닐 때
  const noticeEnabled = program.community_settings?.noticeEnabled !== false
  const latestNotice = noticePosts.find(p => p.status === 'visible') || null

  return (
    <div className="px-[11px] pt-2 pb-6 max-w-4xl mx-auto">
      {/* 상단 헤더 — 뒤로 + 제목 + 알림 + 프로필 (풀폭, 모서리 0) */}
      <header className="sticky top-0 z-30 -mx-[11px] -mt-2 mb-[6px] bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto h-[44px] px-2 flex items-center justify-center relative">
          <button type="button" onClick={handleHeaderBack} className="absolute left-2 p-1.5 text-gray-600 hover:text-gray-900" aria-label="뒤로">
            <ChevronLeft className="w-5 h-5" />
          </button>
          {/* 제목 + 상태 배지 — 항상 화면 정중앙 (좌우 버튼 폭과 무관) */}
          {/* 제목은 항상 정중앙 / 상태 배지는 제목 왼쪽에 오버행(중앙 정렬에 영향 X) */}
          <div className={`relative ${isOwner ? 'max-w-[50%]' : 'max-w-[58%]'}`}>
            <span className="block text-[16px] font-bold text-gray-800 truncate px-1 text-center whitespace-nowrap">{program.name}</span>
            <span className={`absolute right-full top-1/2 -translate-y-1/2 mr-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${hdrStatusCls}`}>{hdrStatusLabel}</span>
          </div>
          <div className="absolute right-2 flex items-center gap-0.5">
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsPanelOpen(true)}
                className="relative w-8 h-8 flex items-center justify-center flex-shrink-0 text-gray-600 hover:text-amber-600 transition"
                title="운영자 메뉴"
                aria-label="운영자 메뉴"
              >
                <Settings className="w-[18px] h-[18px]" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </button>
            )}
            <NotificationBell bare compact showBack />
            <ProfileButton bare compact showBack />
          </div>
        </div>
      </header>

      {/* 프로그램 헤더 — 모의도 디자인: 배경 사진 풀 블리드 + 우측 페이드 + 진행중 배지.
          인라인 관리자 열림(inManager) 시엔 숨김 → 집중 편집 화면 */}
      {!inManager && (() => {
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
                imagePath={overviewManageOpen && managedCover !== undefined ? managedCover : program.cover_image_path}
                categories={program.categories}
                name={program.name}
                variant="hero"
                className="w-full h-full aspect-auto rounded-none"
              />
              {/* 사진 우측 끝에서 흰색으로 페이드 — 텍스트와 자연스럽게 연결 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-white" />
            </div>

            {/* 상태 배지는 상단 헤더 제목 옆으로 이전됨 */}

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
                  <div className="flex items-center gap-2 pr-[2px]">
                    <div className="flex-1 h-2 bg-white/70 rounded-full overflow-hidden border border-gray-100">
                      <div
                        className={`h-full rounded-full transition-all ${urgency.barCls || 'bg-emerald-400'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className={`text-sm font-semibold flex-shrink-0 ${urgency.textCls || 'text-emerald-600'}`}>
                      {progress}%{urgency.label && ` ${urgency.urgency === 'ended' ? '🏁' : urgency.urgency === 'imminent' ? '🔥' : '⏳'}`}
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

      {/* 운영자 진입은 헤더 톱니바퀴(⚙️)로 통합 — 인라인 관리자 열 때 스크롤 기준점만 유지 */}
      {isOwner && <div ref={opPanelRef} className="scroll-mt-[52px]" aria-hidden="true" />}

      {/* 탭 바 — 개요/미션/퀴즈/커뮤니티/성장. 마지막 탭 라벨은 gamification_type 에 따라 분기.
          본인 결정 (Day 65): 정원/별자리도 「성장」 통합 라벨로 일원화.
          인라인 관리자 열림 시엔 탭 바도 숨김(집중 편집 화면) */}
      {!inManager && (() => {
        // 「랭킹 메뉴 표시」(ranking_enabled) OFF 면 성장/랭킹 탭 자체를 숨김 — gamification_type 보다 우선.
        const gType = program.ranking_enabled === false
          ? null
          : (program.gamification_type || 'RANKING')
        // 열람자에겐 개인 정원/별자리 대신 랭킹 목록 → 라벨도 '랭킹'
        const growthLabel = isViewer
          ? (gType ? '랭킹' : null)
          : gType === 'GARDEN' ? '성장' : gType === 'CONSTELLATION' ? '성장' : gType === 'RANKING' ? '랭킹' : null
        const tabs = [
          { key: 'overview', label: '개요' },
          { key: 'missions', label: '미션' },
          // 퀴즈는 참여 필요(열람자 숨김) + 사용 토글 OFF 시 숨김
          ...(!isViewer && quizEnabled ? [{ key: 'quizzes', label: '퀴즈' }] : []),
          ...(communityEnabled ? [{ key: 'community', label: '커뮤니티' }] : []),
          ...(growthLabel ? [{ key: 'ranking', label: growthLabel }] : []),
        ]
        // 방어: 현재 탭이 사라진 탭이면 overview 로 fallback
        const tabGone = (activeTab === 'ranking' && !growthLabel)
          || (activeTab === 'quizzes' && (isViewer || !quizEnabled))
          || (activeTab === 'community' && !communityEnabled)
        const safeActiveTab = tabGone ? 'overview' : activeTab
        return (
          // 메뉴 선택 바 — 풀폭 언더라인 탭 (모서리 0)
          <div className="-mx-[11px] mb-[6px] border-b border-gray-100">
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

      {/* 인증 심사 대기 배너 — 운영자 + 검토 필요 인증 (개요·미션 탭). 탭하면 인증 검토 큐 */}
      {isOwner && pendingReviews.length > 0 && (activeTab === 'overview' || activeTab === 'missions') && (
        <button type="button" onClick={() => setVreviewOpen(true)}
          className="w-full flex items-center gap-2.5 mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-left hover:bg-emerald-100/70 transition">
          <span className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 text-[15px]">📝</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-gray-800">인증 심사 대기 {pendingReviews.length}건</p>
            <p className="text-[11px] text-emerald-700/80">탭해서 한 번에 검토 (승인/거절)</p>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        </button>
      )}

      {/* ─── 개요 탭 — 관리자 편집 폼 (미리보기 중엔 숨김, mounted 유지) ─── */}
      {activeTab === 'overview' && overviewManageOpen && (
        <div className={overviewPreview ? 'hidden' : ''}>
          <OverviewManagePanel
            ref={managePanelRef}
            program={program}
            participantCount={ranking.length}
            progress={calcProgress(program.start_date, program.end_date)}
            onCoverChange={setManagedCover}
            onSaved={() => queryClient.invalidateQueries({ queryKey: queryKeys.program(id) })}
          />
        </div>
      )}

      {/* ─── 개요 탭 (일반 콘텐츠) ─────────────────────────── */}
      {activeTab === 'overview' && (!overviewManageOpen || overviewPreview) && (<>

      {/* 누적 지표 카드 (121) — 단위별 함께/내 누적. 승인된 기록 합산 */}
      {metricTotals.length > 0 && (() => {
        const fmt = (n) => Number(n || 0).toLocaleString('ko-KR', { maximumFractionDigits: 2 })
        return (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-4 mb-[9px]">
            <h3 className="text-sm font-semibold text-emerald-700 mb-2.5">📊 함께 쌓은 기록</h3>
            <div className="space-y-3">
              {metricTotals.map(m => (
                <div key={m.unit} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-emerald-600/80 mb-0.5">함께</p>
                    <p className="text-xl font-bold text-emerald-700 leading-none truncate">{fmt(m.total)}<span className="text-sm font-medium ml-0.5">{m.unit}</span></p>
                  </div>
                  <div className="w-px h-8 bg-emerald-200 flex-shrink-0" />
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-[11px] text-gray-500 mb-0.5">내 누적</p>
                    <p className="text-xl font-bold text-gray-800 leading-none truncate">{fmt(m.mine)}<span className="text-sm font-medium ml-0.5 text-gray-500">{m.unit}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

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
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-[9px]">
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
            <h2 className="text-lg font-semibold text-gray-800">📝 {program.overview_title?.trim() || '안내'}</h2>
            {/* 수정은 운영자 패널(개요 관리자) → 안내 섹션에서. 여기 연필 버튼 제거. */}
          </div>
          {program.overview_content?.trim() ? (
            <MarkdownView content={program.overview_content} />
          ) : (
            <p className="text-sm text-gray-400 text-center py-4 break-keep whitespace-nowrap">
              ✏️ 운영자 메뉴에서 안내 글을 작성해보세요
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

      {/* 개요 관리자 — 하단 고정 바 (미리보기/임시저장/개요 저장) */}
      {activeTab === 'overview' && overviewManageOpen && (
        <div className="sticky bottom-0 -mx-[11px] px-[11px] pt-2 pb-3 bg-white border-t border-gray-100 z-20">
          {panelError && <p className="text-[12px] text-red-600 text-center mb-2">{panelError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={toggleOverviewPreview} className="flex-1 h-11 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-bold hover:bg-emerald-50 transition">
              {overviewPreview ? '✏️ 편집으로' : '👁 미리보기'}
            </button>
            <button type="button" onClick={() => handleOverviewSave(false)} disabled={panelSaving} className="flex-1 h-11 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-bold hover:bg-emerald-50 transition disabled:opacity-50">
              임시저장
            </button>
            <button type="button" onClick={() => handleOverviewSave(true)} disabled={panelSaving} className="flex-[1.4] h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition disabled:opacity-50">
              {panelSaving ? '저장 중...' : '개요 저장'}
            </button>
          </div>
        </div>
      )}
      {/* ─── /개요 탭 ──────────────────────────────────── */}

      {/* ─── 미션 탭 — 관리자 작업 페이지 (미리보기 중엔 숨김) ─── */}
      {activeTab === 'missions' && missionManageOpen && !missionPreview && (
        <MissionManagePanel
          missions={missions}
          onEdit={(mission) => { setEditingMission(mission); setIsMissionCreateOpen(true) }}
          onDelete={handleMissionDelete}
          onDuplicate={handleMissionDuplicate}
          onReorder={handleMissionReorder}
          onAdd={() => setIsLibraryOpen(true)}
          isBusy={deleteMissionMutation.isPending || duplicateMissionMutation.isPending}
        />
      )}

      {/* ─── 미션 탭 (일반/깔끔 뷰) — 관리 모드에선 미리보기 때만 노출 ─── */}
      {activeTab === 'missions' && (!missionManageOpen || missionPreview) && (<>

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
          {/* 미션 추가 — 운영자 전용 빠른 추가(미리보기 중 숨김). 라이브러리 모달 진입 */}
          {isOwner && !missionPreview && (
            <button
              type="button"
              onClick={() => setIsLibraryOpen(true)}
              title="미션 추가"
              aria-label="미션 추가"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
            >
              <Plus className="w-5 h-5" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
      {missions.length === 0 ? (
        <EmptyState icon="🎯" title="미션이 아직 없어요" description={isOwner && !missionPreview ? '오른쪽 + 버튼으로 새 미션을 추가하세요' : undefined} />
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
                      showOwnerActions={false}
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

      {/* 미션 관리자 — 하단 고정 바 (미리보기/임시저장/미션 저장). 미션 편집·삭제·복제는 즉시 반영. */}
      {activeTab === 'missions' && missionManageOpen && (
        <div className="sticky bottom-0 -mx-[11px] px-[11px] pt-2 pb-3 bg-white border-t border-gray-100 z-20">
          <div className="flex gap-2">
            <button type="button" onClick={toggleMissionPreview} className="flex-1 h-11 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-bold hover:bg-emerald-50 transition">
              {missionPreview ? '✏️ 편집으로' : '👁 미리보기'}
            </button>
            <button type="button" onClick={closeMissionManage} className="flex-1 h-11 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-bold hover:bg-emerald-50 transition">
              임시저장
            </button>
            <button type="button" onClick={closeMissionManage} className="flex-[1.4] h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition">
              미션 저장
            </button>
          </div>
        </div>
      )}
      {/* ─── /미션 탭 ──────────────────────────────────── */}

      {/* ─── 퀴즈 탭 — 관리자 작업 페이지 (미리보기 중 숨김) ─── */}
      {activeTab === 'quizzes' && quizManageOpen && !quizPreview && (
        <QuizManagePanel
          quizzes={programQuizzes}
          participantCount={ranking.length}
          onEdit={(q) => navigate(`/programs/${id}/posts/quiz/${q.id}/edit`)}
          onPreview={(q) => navigate(`/programs/${id}/quiz/${q.id}?preview=1`)}
          onResults={(q) => navigate(`/programs/${id}/posts/quiz/${q.id}`)}
          onDelete={handleQuizDelete}
          onDuplicate={(q) => duplicateQuizMutation.mutate(q)}
          onAdd={() => setQuizLibOpen(true)}
          isBusy={deleteQuizMutation.isPending || duplicateQuizMutation.isPending}
        />
      )}

      {/* ─── 퀴즈 탭 (일반/참가자 뷰) ─── */}
      {activeTab === 'quizzes' && (!quizManageOpen || quizPreview) && (<>
      {(() => {
        const quizList = isOwner ? programQuizzes : participantQuizzes
        // 참가자(비운영자)는 풀 퀴즈가 없으면 빈 상태만. 운영자는 헤더+추가 버튼 유지.
        if (!isOwner && quizList.length === 0) {
          return <EmptyState icon="📝" title="아직 풀 수 있는 퀴즈가 없어요" />
        }
        return (
        <div ref={quizSectionRef} className="scroll-mt-16">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">📝 퀴즈</h2>
            <div className="flex items-center gap-2">
              {quizList.length > 3 && (
                <button
                  type="button"
                  onClick={() => { setShowAllQuizzes(!showAllQuizzes); scrollToSection(quizSectionRef) }}
                  className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700"
                >
                  {showAllQuizzes ? '간단히 보기' : `전체보기 (${quizList.length})`}
                  {!showAllQuizzes && <ChevronRight className="w-3 h-3" />}
                </button>
              )}
              {/* 퀴즈 추가 — 운영자 전용 빠른 추가(미리보기 중 숨김). 퀴즈 라이브러리 진입 */}
              {isOwner && !quizPreview && (
                <button
                  type="button"
                  onClick={() => setQuizLibOpen(true)}
                  title="퀴즈 추가"
                  aria-label="퀴즈 추가"
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                >
                  <Plus className="w-5 h-5" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
          {quizList.length === 0 ? (
            <EmptyState icon="📝" title="아직 퀴즈가 없어요" description="오른쪽 + 버튼으로 새 퀴즈를 추가하세요" />
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {(showAllQuizzes ? quizList : quizList.slice(0, 3)).map(quiz => (
                <QuizListItem key={quiz.id} quiz={quiz} programId={id} quizPreview={quizPreview} />
              ))}
            </div>
          )}
        </div>
        )
      })()}
      </>)}

      {/* 퀴즈 관리자 — 하단 고정 바 (미리보기/임시저장/퀴즈 저장) */}
      {activeTab === 'quizzes' && quizManageOpen && (
        <div className="sticky bottom-0 -mx-[11px] px-[11px] pt-2 pb-3 bg-white border-t border-gray-100 z-20">
          <div className="flex gap-2">
            <button type="button" onClick={toggleQuizPreview} className="flex-1 h-11 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-bold hover:bg-emerald-50 transition">
              {quizPreview ? '✏️ 편집으로' : '👁 미리보기'}
            </button>
            <button type="button" onClick={closeQuizManage} className="flex-1 h-11 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-bold hover:bg-emerald-50 transition">
              임시저장
            </button>
            <button type="button" onClick={closeQuizManage} className="flex-[1.4] h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition">
              퀴즈 저장
            </button>
          </div>
        </div>
      )}
      {/* ─── /퀴즈 탭 ──────────────────────────────────── */}

      {/* ─── 커뮤니티 탭 ────────────────────────────────── */}
      {/* 본인 결정 (Day 58): 진입 카드 제거 → 바로 피드 임베드. ProgramFeedPage 와 동일 컴포넌트 공유. */}
      {/* 커뮤니티 관리자 작업 페이지 */}
      {activeTab === 'community' && communityManageOpen && (
        <CommunityManagePanel
          ref={communityManageRef}
          program={program}
          onSaved={() => queryClient.invalidateQueries({ queryKey: queryKeys.program(id) })}
        />
      )}

      {/* 커뮤니티 일반(피드) 뷰 */}
      {activeTab === 'community' && !communityManageOpen && (<>

      {program.feed_enabled ? (
        <>
          {/* 검토 대기 통합 배너 — 운영자 + 대기 1건↑ (모든 게시판 가로지름, 칩 위 최상단) */}
          {isOwner && pendingPosts.length > 0 && (
            <button type="button" onClick={() => setReviewOpen(true)}
              className="w-full flex items-center gap-2.5 mb-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left hover:bg-amber-100/70 transition">
              <span className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 text-[15px]">🕐</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-gray-800">검토 대기 글 {pendingPosts.length}건</p>
                <p className="text-[11px] text-amber-700/80">승인해야 다른 참여자에게 노출돼요 · 탭해서 한 번에 검토</p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
            </button>
          )}
          {/* 게시판 칩 — 운영자 설정 순서대로 */}
          {communityBoards.length > 1 && (
            <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-2 mb-1 scrollbar-hide">
              {communityBoards.map(b => {
                const on = communityBoard === b.id
                const pending = isOwner ? (communityPendingCounts[b.id] || 0) : 0   // 운영자만 검토 대기 배지
                return (
                  <button key={b.id} type="button" onClick={() => setCommunityBoard(b.id)}
                    className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${on ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {BOARD_ICON[b.id] && <span>{BOARD_ICON[b.id]}</span>}{b.name}
                    {pending > 0 && (
                      <span className={`ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold ${on ? 'bg-white text-emerald-600' : 'bg-amber-500 text-white'}`}>{pending > 9 ? '9+' : pending}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
          {/* 공지 배너 — 칩 아래, 게시물 위 */}
          {noticeEnabled && latestNotice && communityBoard !== 'notice' && (
            <button type="button" onClick={() => setCommunityBoard('notice')}
              className="w-full flex items-center gap-2.5 mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-left hover:bg-emerald-100/60 transition">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[11px] font-bold flex-shrink-0">📢 공지</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-gray-800 truncate">{latestNotice.title || latestNotice.body}</p>
                {latestNotice.title && <p className="text-[11px] text-gray-500 truncate">{latestNotice.body}</p>}
              </div>
              <span className="text-[11px] text-gray-400 flex-shrink-0">{formatRelativeKstDay(latestNotice.created_at)}</span>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </button>
          )}
          {boardHasFeed ? (
            <Suspense fallback={<LoadingState text="피드 불러오는 중..." />}>
              <FeedContent program={program} layout={activeBoardLayout} readOnly={isViewer} />
            </Suspense>
          ) : isCommunityLoading ? (
            <LoadingState text="게시글 불러오는 중..." />
          ) : (
            <CommunityPostList programId={id} boardId={communityBoard} posts={communityPosts} myUserId={userId} isOwner={isOwner}
              layout={activeBoardLayout} canReact={canReact} canComment={canComment}
              focusPostId={focusPostId} focusCommentId={focusCommentId} onFocusHandled={clearFocusPost}
              onEdit={(p) => { setEditingPost(p); setIsPostModalOpen(true) }} />
          )}

          {/* 글쓰기 — 지금 보고 있는 게시판이 '내가 쓸 수 있는' 보드일 때만 (열람자 제외).
              예: 참여자가 공지(readonly) 칩에선 글쓰기 바가 안 뜸 → 혼란 방지 */}
          {!isViewer && writableBoards.some(b => b.id === communityBoard) && (
            <div className="sticky bottom-0 -mx-[11px] px-[11px] pt-3 pb-3 bg-gradient-to-t from-white via-white/95 to-transparent z-20">
              <button type="button"
                onClick={() => { setEditingPost(null); setIsPostModalOpen(true) }}
                className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition">
                <Pencil className="w-4 h-4" /> 글쓰기
              </button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon="🔒"
          title="이 프로그램은 커뮤니티가 꺼져 있어요"
          description="운영자가 피드 옵션을 활성화하면 참여자들의 인증을 함께 볼 수 있어요"
        />
      )}

      </>)}

      {/* 커뮤니티 관리자 — 하단 고정 바 */}
      {activeTab === 'community' && communityManageOpen && (
        <div className="sticky bottom-0 -mx-[11px] px-[11px] pt-2 pb-3 bg-white border-t border-gray-100 z-20">
          {panelError && <p className="text-[12px] text-red-600 text-center mb-2">{panelError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={closeCommunityManage} className="flex-1 h-11 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-bold hover:bg-emerald-50 transition">닫기</button>
            <button type="button" onClick={handleCommunitySave} disabled={panelSaving} className="flex-[1.6] h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition disabled:opacity-50">
              {panelSaving ? '저장 중...' : '커뮤니티 저장'}
            </button>
          </div>
        </div>
      )}
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
            onClose={handleEditModalClose}
            onSuccess={invalidateProgramData}
          />
        )}
        {isRankingOpen && (
          <RankingSettingsModal
            program={program}
            isOpen={true}
            onClose={handleRankingClose}
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
        {/* 퀴즈 라이브러리 — 퀴즈 관리자 「새 퀴즈 추가」 진입점 */}
        <QuizLibraryModal
          isOpen={isQuizLibOpen}
          onClose={closeQuizLib}
          programId={id}
          initialSelection={searchParams.get('quizlib')}
        />
        {/* 커뮤니티 게시판 글쓰기 */}
        <CommunityPostModal
          isOpen={isPostModalOpen}
          onClose={() => { setIsPostModalOpen(false); setEditingPost(null) }}
          program={program}
          boards={writableBoards}
          defaultBoardId={writableBoards.some(b => b.id === communityBoard) ? communityBoard : writableBoards[0]?.id}
          editPost={editingPost}
        />
        {/* 운영자 통합 검토함 — 모든 게시판 검토 대기 글 승인/거절 */}
        <CommunityReviewModal
          isOpen={reviewOpen}
          onClose={() => setReviewOpen(false)}
          programId={id}
          posts={pendingPosts}
          boards={communityBoards}
        />
        {/* 운영자 인증 검토 큐 — 검토 필요 인증 한 건씩 승인/거절 */}
        <VerificationReviewModal
          isOpen={vreviewOpen}
          onClose={() => setVreviewOpen(false)}
          programId={id}
          reviews={pendingReviews}
          reviewerId={userId}
        />
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

      {/* 운영자 메뉴 시트 — 헤더 ⚙️ 진입. 3단계: 루트 → 내 프로그램 설정 → 메뉴바 설정 */}
      {isOwner && (
        <Modal isOpen={isPanelOpen} onClose={closePanel}>
          <div className="p-5">
            {panelView === 'root' && (
              <>
                <h2 className="text-lg font-bold text-gray-800 mb-4">⚙️ 운영자 메뉴</h2>
                <div className="grid grid-cols-1 gap-2.5">
                  <PanelMenuBox icon="🛠️" title="내 프로그램 설정" desc="프로그램 · 메뉴바(개요~랭킹)" chevron onClick={() => setPanelView('settings')} />
                  <PanelMenuBox icon="📊" title="통계" desc="참여·인증·미션별 현황" onClick={() => { closePanel(); navigate(`/programs/${id}/stats`, { state: { backToOpMenu: 'root' } }) }} />
                  {communityEnabled && (
                    <PanelMenuBox icon="🚩" title="신고 · 숨김 관리" desc="신고된 글·인증 · 가려진 인증 관리" chevron badge={unresolvedReportCount || undefined} onClick={() => setPanelView('reports')} />
                  )}
                  {canInvite && (
                    <PanelMenuBox icon="🎟️" title="초대하기" desc="링크로 참여자 초대" onClick={() => { closePanel(); setIsInviteOpen(true) }} />
                  )}
                  {pendingCount > 0 && (
                    <PanelMenuBox icon="🙋" title="참여 승인 심사" desc="신청자 답변 확인 · 승인/거절" badge={pendingCount} onClick={() => { closePanel(); setIsApprovalsOpen(true) }} />
                  )}
                </div>
                {/* 위험 구역 — 프로그램 삭제 (운영자만, 2단계 확인) */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <PanelMenuBox danger icon="🗑️" title="이 프로그램 삭제하기" desc="프로그램과 모든 데이터 영구 삭제 · 되돌릴 수 없음" onClick={() => { closePanel(); setIsDeleteOpen(true) }} />
                </div>
              </>
            )}

            {panelView === 'settings' && (
              <>
                <div className="flex items-center gap-1.5 mb-4">
                  <button type="button" onClick={() => setPanelView('root')} className="p-1 -ml-1 text-gray-500 hover:text-gray-800" aria-label="뒤로">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-bold text-gray-800">내 프로그램 설정</h2>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  <PanelMenuBox icon="📋" title="프로그램 설정" desc="이름·기간·카테고리·공개 + 퀴즈/커뮤니티 사용" onClick={() => { closePanel(); editReturnViewRef.current = 'settings'; setIsEditOpen(true) }} />
                  <PanelMenuBox icon="🗂️" title="메뉴바 설정" desc="개요·미션·퀴즈·커뮤니티·랭킹" chevron onClick={() => setPanelView('menubar')} />
                </div>
              </>
            )}

            {panelView === 'menubar' && (
              <>
                <div className="flex items-center gap-1.5 mb-4">
                  <button type="button" onClick={() => setPanelView('settings')} className="p-1 -ml-1 text-gray-500 hover:text-gray-800" aria-label="뒤로">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-bold text-gray-800">메뉴바 설정</h2>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  <PanelMenuBox icon="📝" title="개요 설정" desc="개요 글·표지" onClick={() => openManagerFromMenu('overview')} />
                  <PanelMenuBox icon="🎯" title="미션 설정" desc="미션 추가·수정·순서" onClick={() => openManagerFromMenu('missions')} />
                  {quizEnabled && (
                    <PanelMenuBox icon="📋" title="퀴즈 설정" desc="퀴즈 생성·수정·결과" onClick={() => openManagerFromMenu('quizzes')} />
                  )}
                  {communityEnabled && (
                    <PanelMenuBox icon="💬" title="커뮤니티 설정" desc="게시판·피드·신고 관리" onClick={() => openManagerFromMenu('community')} />
                  )}
                  <PanelMenuBox icon="🏆" title="랭킹 설정" desc="랭킹 표시·시상대·공개 등" onClick={() => openManagerFromMenu('ranking')} />
                </div>
              </>
            )}

            {panelView === 'reports' && (
              <>
                <div className="flex items-center gap-1.5 mb-4">
                  <button type="button" onClick={() => setPanelView('root')} className="p-1 -ml-1 text-gray-500 hover:text-gray-800" aria-label="뒤로">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-bold text-gray-800">🚩 신고 · 숨김 관리</h2>
                </div>
                <ReportsManageSection programId={id} onNavigate={closePanel} />
                {program.feed_enabled && (
                  <div className="mt-6 pt-5 border-t border-gray-100">
                    <HiddenPostsSection programId={id} feedEnabled={!!program.feed_enabled} />
                  </div>
                )}
              </>
            )}
          </div>
        </Modal>
      )}

      {/* 퀴즈 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={quizToDelete != null}
        onClose={() => setQuizToDelete(null)}
        onConfirm={() => deleteQuizMutation.mutate(quizToDelete.id)}
        title="퀴즈를 삭제할까요?"
        message={quizToDelete ? `"${quizToDelete.title}" 퀴즈를 삭제하면\n참가자 제출과 부여된 점수가 함께 삭제됩니다.\n되돌릴 수 없어요.` : ''}
        confirmLabel="삭제"
        danger
        busy={deleteQuizMutation.isPending}
      />

      {/* 미션 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={missionToDelete != null}
        onClose={() => setMissionToDelete(null)}
        onConfirm={() => deleteMissionMutation.mutate(missionToDelete.id)}
        title="미션을 삭제할까요?"
        message={missionToDelete ? `"${missionToDelete.title}" 미션을 삭제하면\n참가자의 모든 인증 기록과 부여된 점수가 함께 삭제됩니다.\n되돌릴 수 없어요.` : ''}
        confirmLabel="삭제"
        danger
        busy={deleteMissionMutation.isPending}
      />

      {/* 프로그램 나가기 확인 모달 — 참여자 자가 탈퇴 */}
      <ConfirmModal
        isOpen={leaveConfirmOpen}
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={() => leaveMutation.mutate()}
        title="이 프로그램에서 나갈까요?"
        message={`"${program?.name}" 에서 나가면 랭킹·집계에서 빠지고,\n다시 참여해야 활동할 수 있어요.\n (지금까지의 기록은 보존돼요)`}
        confirmLabel="나가기"
        danger
        busy={leaveMutation.isPending}
      />

      {/* 프로그램 삭제 — 운영자 전용 2단계 확인 (제목 입력 + 최종 확인) */}
      {isOwner && (
        <DeleteProgramModal
          isOpen={isDeleteOpen}
          programTitle={program?.name || ''}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={() => deleteProgramMutation.mutate()}
          busy={deleteProgramMutation.isPending}
        />
      )}
    </div>
  )
}

// 퀴즈 목록 1행 — 예정(미시작) 퀴즈는 입장 차단 + 클릭 시 좌우 흔들기.
//   shake 를 카드 로컬 state 로 둬서 부모(ProgramDetailPage) 리렌더에 끊기지 않고
//   끝까지 재생되도록 함 → 예정 미션 카드(MissionCard)와 동일한 흔들림 세기.
function QuizListItem({ quiz, programId, quizPreview }) {
  const navigate = useNavigate()
  const [shake, setShake] = useState(false)
  const sub = quiz.mySubmission
  const now = new Date()
  const isNotStarted = quiz.start_at && new Date(quiz.start_at) > now
  const isExpired = quiz.due_at && new Date(quiz.due_at) < now
  const lockedNotStarted = isNotStarted && !quizPreview
  const handleClick = () => {
    if (lockedNotStarted) {
      setShake(true)
      setTimeout(() => setShake(false), 600)
      return
    }
    navigate(`/programs/${programId}/quiz/${quiz.id}${quizPreview ? '?preview=1' : ''}`)
  }
  return (
    <motion.button
      type="button"
      onClick={handleClick}
      animate={shake ? { x: [0, -8, 8, -7, 7, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.5 }}
      className={`w-full flex items-center gap-3 p-4 bg-white border rounded-2xl transition text-left ${
        lockedNotStarted ? 'border-amber-200 cursor-not-allowed' : 'border-gray-200 hover:bg-gray-50 hover:border-emerald-300'
      }`}
    >
      <span className="text-2xl flex-shrink-0">{lockedNotStarted ? '🔒' : '📝'}</span>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-800 truncate">{quiz.title}</h3>
        <p className={`text-xs mt-0.5 ${lockedNotStarted ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
          {sub
            ? (sub.status === 'PENDING' ? '채점 중' : `완료 · ${sub.total_score}점`)
            : isNotStarted
              ? `예정중 · ${formatKoreanDateTime(quiz.start_at)}부터 열려요`
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
    </motion.button>
  )
}

export default ProgramDetailPage
