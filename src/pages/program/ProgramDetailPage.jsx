import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { ChevronLeft, Plus, ChevronRight } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { formatKoreanDate } from '../../lib/formatters'
import MissionCard from '../../components/program/MissionCard'
import ProgramEditModal from '../../components/program/ProgramEditModal'
import MissionCreateModal from '../../components/program/MissionCreateModal'
import MissionLibraryModal from '../../components/program/MissionLibraryModal'
import ReviewModal from '../../components/program/ReviewModal'
import {
  queryKeys,
  fetchProgram,
  fetchProgramMissions,
  fetchProgramScores,
  fetchProgramRanking,
  fetchTodayCounts,
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
  const [isReviewOpen, setIsReviewOpen] = useState(false)

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

  // 모달 mutation 후 갱신 헬퍼들
  const invalidateProgramData = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.program(id) })
    queryClient.invalidateQueries({ queryKey: queryKeys.programMissions(id) })
  }
  const invalidateAfterReview = () => {
    queryClient.invalidateQueries({ queryKey: ['scores'] })
    queryClient.invalidateQueries({ queryKey: ['verifications'] })
    queryClient.invalidateQueries({ queryKey: ['rankings'] })
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
      <div className="p-6 max-w-4xl mx-auto text-center text-gray-500">
        불러오는 중...
      </div>
    )
  }

  if (programError || !program) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="p-4 bg-red-100 text-red-700 rounded">프로그램을 찾을 수 없습니다</p>
        <Link to="/dashboard" className="block mt-4 text-green-600 hover:underline">
          ← 대시보드로
        </Link>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      {/* 좌측 상단 작은 "<" 백 버튼 */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center justify-center w-9 h-9 -ml-1 mb-2 rounded-full hover:bg-gray-100 transition"
        title="뒤로"
      >
        <ChevronLeft className="w-5 h-5 text-gray-600" />
      </button>

      {/* 프로그램 헤더 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-3">
          <h1 className="text-2xl font-medium text-gray-800">{program.name}</h1>
          <span className={`
            px-2 py-0.5 rounded text-xs
            ${program.status === 'PUBLISHED'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'}
          `}>
            {program.status === 'PUBLISHED' ? '진행중' : program.status}
          </span>
        </div>

        {program.description && (
          <p className="text-gray-600 mb-3 whitespace-pre-wrap">{program.description}</p>
        )}

        {(program.start_date || program.end_date) && (
          <p className="text-sm text-gray-500">
            📅 {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
          </p>
        )}
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
              disabled
              className="px-3 py-2 bg-white border border-amber-200 rounded text-sm text-gray-400 cursor-not-allowed text-left"
              title="추후 진화"
            >
              📋 게시물 관리
              <span className="block text-xs">(COMMUNITY 도입 시)</span>
            </button>
            <button
              type="button"
              onClick={() => setIsReviewOpen(true)}
              className="px-3 py-2 bg-white border border-amber-300 hover:border-amber-500 hover:bg-amber-100 rounded text-sm text-amber-800 transition text-left"
            >
              ✅ 인증 심사
              <span className="block text-xs text-amber-700">MANUAL 미션 승인/반려</span>
            </button>
            <button
              type="button"
              disabled
              className="px-3 py-2 bg-white border border-amber-200 rounded text-sm text-gray-400 cursor-not-allowed text-left"
              title="추후 진화"
            >
              📊 참여자 통계
              <span className="block text-xs">(준비 중)</span>
            </button>
          </div>
        </div>
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
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-xs text-green-700 mb-1">누적</p>
              <p className="font-medium text-green-800">
                <span className="text-2xl">{scores.total}</span>
                <span className="text-base"> P</span>
              </p>
            </div>
          </div>
        )
      })()}

      {/* 미션 목록 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium text-gray-800">📋 미션 목록</h2>
        {isOwner && (
          <button
            type="button"
            onClick={() => setIsLibraryOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-full transition"
          >
            <Plus className="w-4 h-4" />
            미션 추가
          </button>
        )}
      </div>
      {missions.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500 text-sm">
          미션이 아직 없어요
        </div>
      ) : (
        <div className="grid gap-3">
          {missionGroups.map(group => {
            // 단독 그룹 (bundle_title=null) — 미션 카드 풀어서 표시
            if (group.bundleTitle === null) {
              return group.missions.map(m => (
                <MissionCard
                  key={m.id}
                  mission={m}
                  todayCounts={todayCounts}
                  isOwner={isOwner}
                  isDeletePending={deleteMissionMutation.isPending}
                  onDelete={handleMissionDelete}
                  programId={id}
                />
              ))
            }

            // 묶음 카드 — 클릭 시 BundleDetailPage 로 이동
            const totalPoint = group.missions.reduce((s, m) => s + (m.point || 0), 0)
            const bundleParam = encodeURIComponent(group.bundleTitle)

            return (
              <button
                key={group.bundleTitle}
                type="button"
                onClick={() => navigate(`/programs/${id}/bundles/${bundleParam}`)}
                className="w-full flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-emerald-300 transition text-left"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-800 truncate">{group.bundleTitle}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {group.missions.length}개 미션 · 총 {totalPoint}P
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>
            )
          })}
        </div>
      )}

      {/* 랭킹 */}
      <h2 className="text-lg font-medium text-gray-800 mb-3 mt-8">🏆 랭킹</h2>
      {ranking.length === 0 ? (
        <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500 text-sm">
          아직 참여자가 없어요
        </div>
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
                  ${isMe ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}
                `}
              >
                <div className="flex items-center gap-3">
                  <span className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                    ${rankBadgeClass}
                  `}>
                    {row.rank}
                  </span>
                  <span className={`font-medium ${isMe ? 'text-green-800' : 'text-gray-800'}`}>
                    {row.nickname}
                    {isMe && <span className="ml-1 text-xs text-green-600">(나)</span>}
                  </span>
                </div>
                <span className={`text-sm font-medium ${isMe ? 'text-green-700' : 'text-gray-600'}`}>
                  {row.total_score}P
                </span>
              </div>
            )
          })}
        </div>
      )}

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
        onClose={() => setIsMissionCreateOpen(false)}
        onSuccess={invalidateProgramData}
      />

      <ReviewModal
        program={program}
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        onSuccess={invalidateAfterReview}
      />
    </div>
  )
}

export default ProgramDetailPage
