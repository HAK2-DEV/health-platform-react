import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchProgram, fetchProgramStats, fetchUserQuizDetail } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'
import UserQuizList from '../../components/program/UserQuizList'

// 한 유저의 퀴즈 상세 — 응시한 퀴즈별 점수·정답률
// 라우트: /programs/:id/stats/users/:userId/quizzes
function ProgramStatsUserQuizzesPage() {
  const { id, userId: targetUserId } = useParams()
  const { session } = useAuth()
  const myUserId = session?.user?.id

  const { data: program } = useQuery({
    queryKey: queryKeys.program(id), queryFn: () => fetchProgram(id), enabled: !!session && !!id,
  })
  const isOwner = program?.owner_id === myUserId

  const { data: stats } = useQuery({
    queryKey: queryKeys.programStats(id), queryFn: () => fetchProgramStats(id), enabled: !!session && !!id && isOwner,
  })
  const userInfo = stats?.userStats?.find(u => u.user_id === targetUserId) || null

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ['stats', 'userQuizDetail', id, targetUserId],
    queryFn: () => fetchUserQuizDetail(id, targetUserId),
    enabled: !!session && !!id && !!targetUserId && isOwner,
  })

  if (!program) return <LoadingState variant="page" />
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <StickyBackBar fallbackPath={`/programs/${id}/stats/users/${targetUserId}`} title="돌아가기" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">운영자만 통계를 볼 수 있어요</p>
      </div>
    )
  }

  const totalPoint = quizzes.reduce((s, q) => s + (q.total_score || 0), 0)
  const totalCorrect = quizzes.reduce((s, q) => s + q.correct, 0)
  const totalAnswered = quizzes.reduce((s, q) => s + q.answered, 0)
  const rate = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : null

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/stats/users/${targetUserId}`} title="돌아가기" />

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{userInfo?.nickname || '(유저)'}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2"><img src="/icons/feature/quiz.png" alt="" aria-hidden="true" className="w-7 h-7 object-contain" />퀴즈 기록</h1>
        <p className="text-sm text-gray-500 mt-2">
          {quizzes.length}개 응시 · 합계 <b className="text-emerald-700">{totalPoint}P</b>
          {rate != null ? <> · 정답률 <b className="text-emerald-700">{rate}%</b></> : null}
        </p>
      </div>

      {quizzes.length === 0 ? (
        <EmptyState icon="📝" title="응시한 퀴즈가 없어요" description="퀴즈를 풀면 점수와 정답률이 쌓여요" />
      ) : (
        <UserQuizList quizzes={quizzes} />
      )}
    </div>
  )
}

export default ProgramStatsUserQuizzesPage
