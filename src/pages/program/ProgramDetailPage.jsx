import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { ChevronLeft, Plus, ChevronRight } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { formatKoreanDate, formatKoreanDateTime, isUpcomingByStartDate } from '../../lib/formatters'
import MissionCard from '../../components/program/MissionCard'
import StickyBackBar from '../../components/common/StickyBackBar'
import UserAvatar from '../../components/common/UserAvatar'
import EmptyState from '../../components/common/EmptyState'
import LoadingState from '../../components/common/LoadingState'
import ProgramCover from '../../components/common/ProgramCover'
import ProgramEditModal from '../../components/program/ProgramEditModal'
import MissionCreateModal from '../../components/program/MissionCreateModal'
import MissionLibraryModal from '../../components/program/MissionLibraryModal'
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
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const [isMissionCreateOpen, setIsMissionCreateOpen] = useState(false)
  const [editingMission, setEditingMission] = useState(null)  // 미션 수정 — null 이면 생성 모드
  const [showAllMissions, setShowAllMissions] = useState(false)

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
  const displayedMissionCards = showAllMissions ? missionCards : missionCards.slice(0, 2)

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
      `"${mission.title}" 미션을 삭제할까요?\n\n` +
      `⚠️ 이 미션의 모든 인증 기록과 부여된 점수가 함께 삭제돼요. 되돌릴 수 없어요.`
    )) return
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

      {/* 프로그램 헤더 — 표지 사진 + 정보 */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-6">
        <ProgramCover
          imagePath={program.cover_image_path}
          categories={program.categories}
          name={program.name}
          variant="card"
        />
        <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <h1 className="text-2xl font-medium text-gray-800">{program.name}</h1>
          {(() => {
            // PUBLISHED + 시작일 미래 → "예정" (회색) / PUBLISHED + 진행 중 → "진행중" (초록) / 그 외 → status 그대로
            const isPublished = program.status === 'PUBLISHED'
            const isUpcoming = isPublished && isUpcomingByStartDate(program.start_date)
            const label = isPublished ? (isUpcoming ? '예정' : '진행중') : program.status
            const cls = (isPublished && !isUpcoming)
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-600'
            return <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>{label}</span>
          })()}
        </div>

        {/* description 이 name 과 다를 때만 표시 — 중복 회피 (ProgramDetailModal 과 동일 규칙) */}
        {program.description
          && program.description.trim()
          && program.description.trim() !== program.name?.trim() && (
          <p className="text-gray-600 mb-3 whitespace-pre-wrap">{program.description}</p>
        )}

        {(program.start_date || program.end_date) && (
          <p className="text-sm text-gray-500">
            📅 {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
          </p>
        )}
        </div>
      </div>

      {/* 운영자 패널 */}
      {isOwner && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 mb-6">
          <h2 className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-3">
            ⚙️ 운영자 패널
          </h2>
          <div className="grid grid-cols-2 gap-2">
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
        <InviteLinkCard programId={program.id} code={program.invite_code} />
      )}

      {/* 점수 요약 — 오늘 / 누적 */}
      {(() => {
        const todayMax = program.daily_max_score ?? missions.reduce(
          (sum, m) => sum + m.point * (m.daily_limit || 1),
          0
        )
        return (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs text-blue-700 mb-1">오늘 획득</p>
              <p className="font-medium text-blue-800">
                <span className="text-2xl">{scores.today}</span>
                <span className="text-base"> P</span>
                <span className="text-sm text-blue-600 ml-1">/ {todayMax}P</span>
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-xs text-emerald-700 mb-1">누적</p>
              <p className="font-medium text-emerald-800">
                <span className="text-2xl">{scores.total}</span>
                <span className="text-base"> P</span>
              </p>
            </div>
          </div>
        )
      })()}

      {/* 피드 진입 카드 — feed_enabled 면 모든 참여자에게 노출 */}
      {program.feed_enabled && (
        <button
          type="button"
          onClick={() => navigate(`/programs/${id}/feed`)}
          className="w-full flex items-center gap-3 p-4 mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg hover:from-emerald-100 hover:to-teal-100 transition text-left"
        >
          <span className="text-2xl">📷</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-emerald-800">피드 보기</h3>
            <p className="text-xs text-emerald-700">
              참여자들이 올린 인증을 보고 좋아요·댓글로 응원해보세요
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-emerald-500 flex-shrink-0" />
        </button>
      )}

      {/* 미션 목록 — 3개 + 전체보기 토글 + framer 부드러운 전환 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium text-gray-800">📋 미션 목록</h2>
        <div className="flex items-center gap-2">
          {missionCards.length > 2 && (
            <button
              type="button"
              onClick={() => setShowAllMissions(!showAllMissions)}
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

      {/* 퀴즈 섹션 — 참가자 전용, 퀴즈가 있을 때만 노출 */}
      {!isOwner && participantQuizzes.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-800 mb-3">📝 퀴즈</h2>
          <div className="grid grid-cols-1 gap-3">
            {participantQuizzes.map(quiz => {
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

      {/* 랭킹 — program.ranking_enabled=false 면 섹션 자체 숨김 */}
      {program.ranking_enabled !== false && (<>
      <h2 className="text-lg font-medium text-gray-800 mb-3 mt-8">🏆 랭킹</h2>
      {ranking.length === 0 ? (
        <EmptyState icon="👥" title="아직 참여자가 없어요" size="sm" />
      ) : (
        <div className="grid gap-2">
          {ranking.map(row => {
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
                  flex items-center justify-between p-3 rounded-lg border
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
      )}
      </>)}

      {/* 모달들 */}
      <ProgramEditModal
        program={program}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
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
function InviteLinkCard({ programId, code }) {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const inviteUrl = `${origin}/join?program=${programId}&code=${encodeURIComponent(code)}`

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
        아래 링크를 친구/지인에게 공유하면, 클릭만으로 자동 참여돼요. (로그인 후 자동 진행)
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
