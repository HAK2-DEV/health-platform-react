import { useState, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { ChevronLeft, Plus, ChevronRight, Users, Trophy, Pencil } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { CATEGORY } from '../../lib/constants'
import { formatKoreanDate, formatKoreanDateTime, isUpcomingByStartDate } from '../../lib/formatters'
import MissionCard from '../../components/program/MissionCard'
import StickyBackBar from '../../components/common/StickyBackBar'
import UserAvatar from '../../components/common/UserAvatar'
import EmptyState from '../../components/common/EmptyState'
import LoadingState from '../../components/common/LoadingState'
import ProgramCover from '../../components/common/ProgramCover'
import MarkdownView from '../../components/common/MarkdownView'
import { calcProgress } from '../../lib/programVisuals'
import ProgramEditModal from '../../components/program/ProgramEditModal'
import MissionCreateModal from '../../components/program/MissionCreateModal'
import MissionLibraryModal from '../../components/program/MissionLibraryModal'
import OverviewEditModal from '../../components/program/OverviewEditModal'
import FeedContent from '../../components/program/FeedContent'
import {
  queryKeys,
  fetchProgram,
  fetchProgramMissions,
  fetchProgramScores,
  fetchProgramRanking,
  fetchTodayCounts,
  fetchParticipantQuizzes,
} from '../../lib/queries'

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
  const [activeTab, setActiveTab] = useState('overview')

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

  const { data: ranking = [] } = useQuery({
    queryKey: queryKeys.programRanking(id),
    queryFn: () => fetchProgramRanking(id),
    enabled: !!session && !!id,
  })

  const { data: todayCounts = {} } = useQuery({
    queryKey: queryKeys.todayCounts(userId),
    queryFn: () => fetchTodayCounts(userId),
    enabled: !!session,
  })

  const isOwner = program?.owner_id === userId

  // 참가자용 퀴즈 목록 — 참여자(비운영자)에게만. owner 는 게시물 관리로.
  const { data: participantQuizzes = [] } = useQuery({
    queryKey: queryKeys.participantQuizzes(id, userId),
    queryFn: () => fetchParticipantQuizzes(id),
    enabled: !!session && !!id && !!program && !isOwner,
  })

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
    queryClient.invalidateQueries({ queryKey: queryKeys.programMissions(id) })
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

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar onClick={() => navigate(-1)} />

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

        return (
          <div className="relative bg-white border border-gray-200 rounded-2xl overflow-hidden mb-6">
            {/* 배경 사진 — 좌측 일부 영역에만 (전체 너비 X) */}
            <div className="absolute inset-y-0 left-0 w-[38%]">
              {publicUrl ? (
                <img
                  src={publicUrl}
                  alt={program.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-100 flex items-center justify-center">
                  <span className="text-6xl select-none opacity-60">{cat.emoji}</span>
                </div>
              )}
              {/* 사진 우측 끝에서 흰색으로 페이드 — 텍스트와 자연스럽게 연결 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-white" />
            </div>

            {/* 상태 배지 — 사진 위 좌상단 */}
            <span className={`absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md text-xs font-semibold ${statusCls}`}>
              {statusLabel}
            </span>

            {/* 텍스트 영역 — 우측 (사진 끝과 살짝 겹쳐 페이드 자연스럽게) */}
            <div className="relative z-10 pl-[34%] pr-4 sm:pr-5 py-4 sm:py-5 min-h-[140px] sm:min-h-[150px] flex flex-col justify-center">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1.5 sm:mb-2 leading-tight break-words">
                {program.name}
              </h1>
              {(program.start_date || program.end_date) && (
                <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3 flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-gray-400">기간</span>
                  <span>{formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}</span>
                  {totalDays && <span className="text-gray-500">({totalDays}일)</span>}
                </p>
              )}
              {program.start_date && program.end_date && (
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <div className="flex-1 h-2 bg-white/70 rounded-full overflow-hidden border border-gray-100">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 flex-shrink-0">{progress}%</span>
                </div>
              )}
              <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-500">참여자</span>
                  <span className="text-gray-800 font-semibold">{ranking.length}명</span>
                </span>
                {program.ranking_enabled !== false && myRank && (
                  <span className="inline-flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-gray-500">내 순위</span>
                    <span className="text-gray-800 font-semibold">{myRank}등</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* 탭 바 — 개요/미션/퀴즈/커뮤니티/랭킹. 랭킹은 program.ranking_enabled !== false 일 때만 노출 */}
      {(() => {
        const tabs = [
          { key: 'overview', label: '개요' },
          { key: 'missions', label: '미션' },
          { key: 'quizzes', label: '퀴즈' },
          { key: 'community', label: '커뮤니티' },
          ...(program.ranking_enabled !== false ? [{ key: 'ranking', label: '랭킹' }] : []),
        ]
        // 방어: 랭킹 탭이 사라졌는데 현재 ranking 탭이면 overview 로 fallback
        const safeActiveTab = (activeTab === 'ranking' && program.ranking_enabled === false)
          ? 'overview'
          : activeTab
        return (
          <div className="border-b border-gray-200 mb-6">
            <div className="flex">
              {tabs.map(tab => {
                const isActive = safeActiveTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`
                      flex-1 py-3 text-sm border-b-2 transition -mb-px
                      ${isActive
                        ? 'border-emerald-500 text-emerald-600 font-semibold'
                        : 'border-transparent text-gray-500 hover:text-gray-700 font-medium'}
                    `}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ─── 개요 탭 ────────────────────────────────────── */}
      {activeTab === 'overview' && (<>

      {/* 운영자 패널 */}
      {isOwner && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-6">
          <h2 className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-3">
            ⚙️ 운영자 패널
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {/* 개요 글 — 풀너비 (col-span-2). 메인 콘텐츠 작성/수정 액션이라 강조 */}
            <button
              type="button"
              onClick={() => setIsOverviewEditOpen(true)}
              className="col-span-2 px-3 py-2 bg-white border border-amber-300 hover:border-amber-500 hover:bg-amber-100 rounded text-sm text-amber-800 transition text-left"
            >
              📝 개요 글 {program.overview_content?.trim() ? '수정' : '작성'}
              <span className="block text-xs text-amber-700">
                {program.overview_content?.trim() ? '참여자에게 보이는 안내 글 수정' : '프로그램 소개·공지를 마크다운으로 작성'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              className="px-3 py-2 bg-white border border-amber-300 hover:border-amber-500 hover:bg-amber-100 rounded text-sm text-amber-800 transition text-left"
            >
              ✏️ 프로그램 수정
              <span className="block text-xs text-amber-700">이름·기간·카테고리</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/programs/${id}/posts`)}
              className="px-3 py-2 bg-white border border-amber-300 hover:border-amber-500 hover:bg-amber-100 rounded text-sm text-amber-800 transition text-left"
            >
              📋 게시물 관리
              <span className="block text-xs text-amber-700">퀴즈 생성·관리</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/programs/${id}/reviews`)}
              className="px-3 py-2 bg-white border border-amber-300 hover:border-amber-500 hover:bg-amber-100 rounded text-sm text-amber-800 transition text-left"
            >
              ✅ 인증 심사
              <span className="block text-xs text-amber-700">MANUAL 미션 승인/반려</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/programs/${id}/stats`)}
              className="px-3 py-2 bg-white border border-amber-300 hover:border-amber-500 hover:bg-amber-100 rounded text-sm text-amber-800 transition text-left"
            >
              📊 참여자 통계
              <span className="block text-xs text-amber-700">참여 · 인증 · 미션별 현황</span>
            </button>
          </div>
        </div>
      )}

      {/* 초대 링크 카드 — 운영자 + INVITE_CODE + PUBLISHED + 코드 설정됨 일 때만 */}
      {isOwner && program.status === 'PUBLISHED' && program.join_type === 'INVITE_CODE' && program.invite_code && (
        <InviteLinkCard code={program.invite_code} />
      )}

      {/* 점수 요약 — 오늘 / 누적. 좌측 둥근 아이콘 + 우측 텍스트 (본인 결정 Day 58) */}
      {(() => {
        const todayMax = program.daily_max_score ?? missions.reduce(
          (sum, m) => sum + m.point * (m.daily_limit || 1),
          0
        )
        return (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 flex-shrink-0 bg-blue-100 rounded-xl flex items-center justify-center">
                <span className="text-xl">⭐</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-blue-700 mb-0.5">오늘 획득</p>
                <p className="font-medium text-blue-800 leading-tight">
                  <span className="text-xl">{scores.today}</span>
                  <span className="text-sm"> P</span>
                  <span className="text-xs text-blue-600 ml-1">/ {todayMax}P</span>
                </p>
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 flex-shrink-0 bg-emerald-100 rounded-xl flex items-center justify-center">
                <span className="text-xl">🎁</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-emerald-700 mb-0.5">누적</p>
                <p className="font-medium text-emerald-800 leading-tight">
                  <span className="text-xl">{scores.total}</span>
                  <span className="text-sm"> P</span>
                </p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 개요 글 — 운영자 작성 (마크다운). 본인 결정 Day 58
          - 글 있으면: 모두에게 표시 (마크다운 렌더링)
          - 글 없는데 운영자: 작성 안내 + 운영자 패널 버튼으로 작성
          - 글 없고 참가자: 영역 자체 숨김 (조용한 fallback) */}
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
          description="운영자는 게시물 관리 메뉴(운영자 패널 → 📋)에서 퀴즈를 생성·관리할 수 있어요"
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
        <FeedContent program={program} />
      ) : (
        <EmptyState
          icon="🔒"
          title="이 프로그램은 커뮤니티가 꺼져 있어요"
          description="운영자가 피드 옵션을 활성화하면 참여자들의 인증을 함께 볼 수 있어요"
        />
      )}

      </>)}
      {/* ─── /커뮤니티 탭 ──────────────────────────────── */}

      {/* ─── 랭킹 탭 ────────────────────────────────────── */}
      {/* 랭킹 — program.ranking_enabled=false 면 탭 자체가 노출되지 않음 */}
      {activeTab === 'ranking' && program.ranking_enabled !== false && (<>
      <h2 className="text-lg font-semibold text-gray-800 mb-3">🏆 랭킹</h2>
      {ranking.length === 0 ? (
        <EmptyState icon="👥" title="아직 참여자가 없어요" size="sm" />
      ) : (() => {
        const RANK_PAGE = 10
        const hasMore = ranking.length > RANK_PAGE
        const displayed = showAllRanking ? ranking : ranking.slice(0, RANK_PAGE)
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
                  {showAllRanking ? '간단히 보기' : `더보기 (${ranking.length}명)`}
                </button>
              </div>
            )}
          </>
        )
      })()}
      </>)}

      {/* 모달들 */}
      <ProgramEditModal
        program={program}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={invalidateProgramData}
      />

      <OverviewEditModal
        program={program}
        isOpen={isOverviewEditOpen}
        onClose={() => setIsOverviewEditOpen(false)}
        onSuccess={invalidateProgramData}
      />

      <MissionLibraryModal
        program={program}
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onSuccess={invalidateProgramData}
        onCustomCreate={() => {
          setIsLibraryOpen(false)
          setIsMissionCreateOpen(true)
        }}
      />

      <MissionCreateModal
        program={program}
        isOpen={isMissionCreateOpen}
        editMission={editingMission}
        onClose={() => { setIsMissionCreateOpen(false); setEditingMission(null) }}
        onSuccess={invalidateProgramData}
      />
    </div>
  )
}

// 초대 링크 카드 — 운영자가 INVITE_CODE 프로그램의 가입 링크를 복사하도록 도와줌
//   링크 형식: <origin>/join?program=<id>&code=<code>
//   복사 버튼 → 클립보드 → 짧은 "복사 완료" 토스트
function InviteLinkCard({ code }) {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  // code 단독 — 운영자가 ID 알릴 필요 없음 (UNIQUE 보장)
  const inviteUrl = `${origin}/join?code=${encodeURIComponent(code)}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('복사 실패:', err)
      // fallback — select + execCommand 는 모바일에서 흔히 실패. 대신 prompt 로 보여주기
      window.prompt('이 링크를 복사해서 공유해주세요:', inviteUrl)
    }
  }

  return (
    <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 mb-6">
      <h2 className="flex items-center gap-2 text-sm font-medium text-sky-800 mb-2">
        🎟️ 초대 링크
      </h2>
      <p className="text-xs text-sky-700 mb-3 leading-relaxed">
        아래 링크를 공유하면 받은 사람이 코드 입력 없이 프로그램 미리보기로 이동해요. 거기서 "참여하기"를 눌러야 가입됩니다.
      </p>
      <div className="flex items-center gap-2 bg-white border border-sky-200 rounded-xl p-2 mb-2">
        <code className="flex-1 text-xs text-gray-700 truncate select-all">{inviteUrl}</code>
        <button
          type="button"
          onClick={handleCopy}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition flex-shrink-0 ${
            copied
              ? 'bg-emerald-500 text-white'
              : 'bg-sky-500 hover:bg-sky-600 text-white'
          }`}
        >
          {copied ? '✓ 복사됨' : '복사'}
        </button>
      </div>
      <p className="text-[11px] text-sky-600">
        초대 코드: <span className="font-mono font-medium">{code}</span>
      </p>
    </div>
  )
}

export default ProgramDetailPage
