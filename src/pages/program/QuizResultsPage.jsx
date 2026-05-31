import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X, ChevronDown, Users, FileText, AlertCircle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  queryKeys,
  fetchProgram,
  fetchQuizResults,
  gradeQuizAnswer,
} from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'
import UserAvatar from '../../components/common/UserAvatar'
import { formatKoreanDate } from '../../lib/formatters'

// 운영자 퀴즈 결과 페이지
// 라우트: /programs/:id/posts/quiz/:quizId
//   제출 목록 + 펼치면 문제별 답안 + 서술형 MANUAL 답안 정답/오답 채점
function QuizResultsPage() {
  const { id, quizId } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const { data: program } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })
  const isOwner = program?.owner_id === userId

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.quizResults(quizId),
    queryFn: () => fetchQuizResults(quizId),
    enabled: !!quizId && isOwner,
  })

  const [expandedId, setExpandedId] = useState(null)

  const gradeMutation = useMutation({
    mutationFn: ({ answerId, isCorrect }) => gradeQuizAnswer(answerId, isCorrect),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quizResults(quizId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.programQuizzes(id) })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      queryClient.invalidateQueries({ queryKey: ['scores'] })
    },
    onError: (err) => {
      console.error('채점 실패:', err)
      alert(`채점에 실패했어요: ${err.message}`)
    },
  })

  if (!isOwner && program) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-2xl mx-auto">
        <StickyBackBar fallbackPath={`/programs/${id}/posts`} title="게시물 관리로" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-center">
          운영자만 결과를 볼 수 있어요
        </p>
      </div>
    )
  }

  if (isLoading || !data) return <LoadingState variant="page" />

  const { quiz, questions, submissions } = data
  const totalSubs = submissions.length
  const avgScore = totalSubs > 0
    ? Math.round(submissions.reduce((s, sub) => s + sub.total_score, 0) / totalSubs)
    : 0
  const pendingCount = submissions.filter(s => s.status === 'PENDING').length

  const qMap = new Map(questions.map(q => [q.id, q]))

  const displayAnswer = (q, raw) => {
    if (raw == null || raw === '') return '(무응답)'
    if (q.type === 'MULTIPLE') return q.options?.[Number(raw)] ?? raw
    return raw
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/posts`} title="게시물 관리로" />

      {/* 헤더 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
        <p className="text-xs text-gray-500 mb-1">{program?.name}</p>
        <h1 className="text-2xl font-medium text-gray-800 mb-3">📊 {quiz.title}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1 text-gray-600">
            <Users className="w-3.5 h-3.5" /> 제출 {totalSubs}명
          </span>
          <span className="inline-flex items-center gap-1 text-gray-600">
            <FileText className="w-3.5 h-3.5" /> 평균 {avgScore}점
          </span>
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
              <AlertCircle className="w-3.5 h-3.5" /> 채점 대기 {pendingCount}
            </span>
          )}
        </div>
      </div>

      {submissions.length === 0 ? (
        <EmptyState icon="📝" title="아직 제출한 참가자가 없어요" />
      ) : (
        <div className="grid gap-3">
          {submissions.map(sub => {
            const expanded = expandedId === sub.id
            return (
              <div key={sub.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : sub.id)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition text-left"
                >
                  <UserAvatar
                    avatarPath={sub.user?.avatar_path}
                    nickname={sub.user?.nickname}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {sub.user?.nickname || '(알 수 없음)'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {sub.total_score}점 · {formatKoreanDate(sub.submitted_at)}
                    </p>
                  </div>
                  {sub.status === 'PENDING' ? (
                    <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded flex-shrink-0">채점 대기</span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded flex-shrink-0">완료</span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
                </button>

                {expanded && (
                  <div className="border-t border-gray-100 p-3 space-y-2 bg-gray-50">
                    {sub.answers.map(a => {
                      const q = qMap.get(a.question_id)
                      if (!q) return null
                      const needsGrading = q.type === 'SHORT'
                        && q.grading_mode === 'MANUAL'
                        && q.award_mode === 'CORRECT_ONLY'
                        && a.is_correct === null
                      return (
                        <div key={a.id} className="p-3 bg-white border border-gray-200 rounded-lg">
                          <p className="text-sm font-medium text-gray-800 mb-1.5">
                            {q.question_text}
                            <span className="ml-2 text-xs text-gray-400 font-normal">({q.point}점)</span>
                          </p>
                          <p className="text-sm text-gray-700 flex items-center flex-wrap gap-1 mb-1">
                            <span className="text-gray-500">답:</span>
                            <span>{displayAnswer(q, a.answer)}</span>
                            {a.is_correct === true && <Check className="w-4 h-4 text-emerald-500" />}
                            {a.is_correct === false && <X className="w-4 h-4 text-red-500" />}
                            {a.is_correct === null && (
                              <span className="text-xs text-amber-600 ml-1">채점 대기</span>
                            )}
                          </p>
                          {/* 정답 표시 (AUTO 만 정답 보유) */}
                          {q.correct_answer && q.grading_mode === 'AUTO' && (
                            <p className="text-xs text-emerald-700 mb-1">
                              정답: {displayAnswer(q, q.correct_answer)}
                            </p>
                          )}
                          <p className="text-xs text-gray-400">획득 {a.awarded_point}점</p>

                          {/* 수동 채점 버튼 (SHORT MANUAL CORRECT_ONLY 미채점) */}
                          {needsGrading && (
                            <div className="flex gap-2 mt-2.5">
                              <button
                                type="button"
                                onClick={() => gradeMutation.mutate({ answerId: a.id, isCorrect: true })}
                                disabled={gradeMutation.isPending}
                                className="flex-1 py-1.5 text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-md transition disabled:opacity-50"
                              >
                                ✓ 정답 인정 (+{q.point}점)
                              </button>
                              <button
                                type="button"
                                onClick={() => gradeMutation.mutate({ answerId: a.id, isCorrect: false })}
                                disabled={gradeMutation.isPending}
                                className="flex-1 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition disabled:opacity-50"
                              >
                                ✗ 오답 (0점)
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default QuizResultsPage
