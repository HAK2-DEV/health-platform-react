import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChevronRight, Users, Award, AlertCircle, Target } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  queryKeys,
  fetchProgram,
  fetchProgramQuizStats,
} from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'

// 운영자 통계 — 퀴즈별 요약 목록
// 라우트: /programs/:id/stats/quizzes
//   각 퀴즈: 참여율 / 평균 점수 / 정답률 / 채점 대기
//   클릭 → /programs/:id/posts/quiz/:quizId (제출 상세 + 채점)
function ProgramStatsQuizzesPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id

  const { data: program } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })
  const isOwner = program?.owner_id === userId

  const { data: stats = [], isLoading } = useQuery({
    queryKey: queryKeys.programQuizStats(id),
    queryFn: () => fetchProgramQuizStats(id),
    enabled: !!session && !!id && isOwner,
  })

  if (!isOwner && program) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-2xl mx-auto">
        <StickyBackBar fallbackPath={`/programs/${id}/stats`} title="통계로" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-center">
          운영자만 통계를 볼 수 있어요
        </p>
      </div>
    )
  }

  if (isLoading || !program) return <LoadingState variant="page" />

  // 전체 요약
  const totalQuizzes = stats.length
  const totalSubmissions = stats.reduce((s, q) => s + q.submissionCount, 0)
  const totalPending = stats.reduce((s, q) => s + q.pendingCount, 0)

  return (
    <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/stats`} title="통계로" />

      {/* 헤더 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
        <p className="text-xs text-gray-500 mb-1">{program.name}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2">
          📝 퀴즈 현황
        </h1>
        {totalQuizzes > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            퀴즈 {totalQuizzes}개 · 누적 제출 {totalSubmissions}건
            {totalPending > 0 && <span className="text-amber-600 font-medium"> · 채점 대기 {totalPending}</span>}
          </p>
        )}
      </div>

      {stats.length === 0 ? (
        <EmptyState
          icon="📝"
          title="아직 만든 퀴즈가 없어요"
          description="게시물 관리에서 퀴즈를 만들 수 있어요"
          action={{ label: '게시물 관리로', onClick: () => navigate(`/programs/${id}/posts`) }}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="grid gap-3"
        >
          {stats.map(q => {
            const isExpired = q.due_at && new Date(q.due_at) < new Date()
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => navigate(`/programs/${id}/posts/quiz/${q.id}`)}
                className="w-full bg-white border border-gray-200 rounded-2xl p-4 hover:bg-gray-50 hover:border-emerald-300 transition text-left"
              >
                {/* 제목 + 배지 */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h2 className="font-medium text-gray-800 flex-1 min-w-0">{q.title}</h2>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {q.pendingCount > 0 && (
                      <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded inline-flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        대기 {q.pendingCount}
                      </span>
                    )}
                    {isExpired && (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">마감</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>

                {/* 4지표 그리드 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <StatCell
                    icon={<Users className="w-3.5 h-3.5" />}
                    label="참여율"
                    value={`${q.participationRate}%`}
                    sub={`${q.submissionCount}/${q.participantCount}명`}
                  />
                  <StatCell
                    icon={<Award className="w-3.5 h-3.5" />}
                    label="평균"
                    value={`${q.avgScore}점`}
                    sub={`/ ${q.totalPoints}점`}
                  />
                  <StatCell
                    icon={<Target className="w-3.5 h-3.5" />}
                    label="정답률"
                    value={q.correctRate !== null ? `${q.correctRate}%` : '—'}
                    sub={q.correctRate !== null ? '자동 채점' : '집계 불가'}
                  />
                  <StatCell
                    label="문제"
                    value={`${q.questionCount}개`}
                    sub=""
                  />
                </div>
              </button>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

// 작은 지표 셀
function StatCell({ icon, label, value, sub }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2 min-w-0">
      <p className="flex items-center gap-1 text-[11px] text-gray-500 whitespace-nowrap">
        {icon}
        {label}
      </p>
      <p className="text-sm font-medium text-gray-800 mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

export default ProgramStatsQuizzesPage
