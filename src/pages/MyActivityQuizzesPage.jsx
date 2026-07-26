import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { queryKeys, fetchProgram, fetchUserQuizDetail } from '../lib/queries'
import StickyBackBar from '../components/common/StickyBackBar'
import LoadingState from '../components/common/LoadingState'
import EmptyState from '../components/common/EmptyState'
import UserQuizList from '../components/program/UserQuizList'

// 참가자 본인 — 내 퀴즈 기록 (내 인증 현황 드릴다운, 문항별 정답 포함)
// 라우트: /profile/activity/:programId/quizzes
function MyActivityQuizzesPage() {
  const { programId } = useParams()
  const { session } = useAuth()
  const userId = session?.user?.id

  const { data: program } = useQuery({
    queryKey: queryKeys.program(programId), queryFn: () => fetchProgram(programId), enabled: !!session && !!programId,
  })
  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ['myActivity', 'quizDetail', programId, userId],
    queryFn: () => fetchUserQuizDetail(programId, userId),
    enabled: !!session && !!programId && !!userId,
  })

  if (isLoading || !program) return <LoadingState variant="page" />

  const totalPoint = quizzes.reduce((s, q) => s + (q.total_score || 0), 0)
  const totalCorrect = quizzes.reduce((s, q) => s + q.correct, 0)
  const totalAnswered = quizzes.reduce((s, q) => s + q.answered, 0)
  const rate = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : null

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath="/profile/activity" title="돌아가기" />
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2"><img src="/icons/feature/quiz.png" alt="" aria-hidden="true" className="w-7 h-7 object-contain" />내 퀴즈 기록</h1>
        <p className="text-sm text-gray-500 mt-2">
          {quizzes.length}개 응시 · 합계 <b className="text-emerald-700">{totalPoint}P</b>
          {rate != null ? <> · 정답률 <b className="text-emerald-700">{rate}%</b></> : null}
        </p>
      </div>
      {quizzes.length === 0
        ? <EmptyState icon="📝" title="응시한 퀴즈가 없어요" description="퀴즈를 풀면 점수와 정답률이 쌓여요" />
        : <UserQuizList quizzes={quizzes} />}
    </div>
  )
}

export default MyActivityQuizzesPage
