import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Check, X, Clock, Trophy } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  queryKeys,
  fetchQuizForParticipant,
  submitQuiz,
} from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import { formatKoreanDateTime } from '../../lib/formatters'

// 참가자 퀴즈 풀이/결과 페이지
// 라우트: /programs/:id/quiz/:quizId
//   미제출 → 풀이 폼 / 제출 완료 → 결과 (점수 + 정답공개 시 정오)
function QuizSolvePage() {
  const { id, quizId } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.quizDetail(quizId, userId),
    queryFn: () => fetchQuizForParticipant(quizId),
    enabled: !!quizId && !!userId,
  })

  const [answers, setAnswers] = useState({})
  const [submitError, setSubmitError] = useState(null)

  const submitMutation = useMutation({
    mutationFn: () => {
      const payload = (data?.questions || []).map(q => ({
        question_id: q.id,
        answer: answers[q.id] ?? '',
      }))
      return submitQuiz(quizId, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quizDetail(quizId, userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.participantQuizzes(id, userId) })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      queryClient.invalidateQueries({ queryKey: ['scores'] })
      setSubmitError(null)
    },
    onError: (err) => {
      console.error('퀴즈 제출 실패:', err)
      setSubmitError(err.message || '제출에 실패했어요')
    },
  })

  if (isLoading) return <LoadingState variant="page" />
  if (isError || !data) {
    return (
      <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
        <StickyBackBar fallbackPath={`/programs/${id}`} title="프로그램으로" />
        <p className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-center">
          퀴즈를 불러올 수 없어요
        </p>
      </div>
    )
  }

  const { quiz, questions, my_submission } = data
  const myAnswers = data.my_answers || []
  const isSubmitted = !!my_submission
  const now = new Date()
  const isNotStarted = quiz.start_at && new Date(quiz.start_at) > now
  const isExpired = quiz.due_at && new Date(quiz.due_at) < now

  // 결과 모드 답안 매핑
  const answerMap = {}
  myAnswers.forEach(a => { answerMap[a.question_id] = a })

  const setAnswer = (qId, value) => setAnswers(prev => ({ ...prev, [qId]: value }))

  const displayAnswer = (q, raw) => {
    if (raw == null || raw === '') return '(무응답)'
    if (q.type === 'MULTIPLE') return q.options?.[Number(raw)] ?? raw
    return raw
  }

  const unanswered = questions.filter(q => !answers[q.id]?.toString().trim()).length

  const handleSubmit = () => {
    if (unanswered > 0) {
      if (!window.confirm(`아직 답하지 않은 문제가 ${unanswered}개 있어요. 제출할까요?`)) return
    }
    submitMutation.mutate()
  }

  return (
    <div className="px-4 pt-2 pb-24 max-w-2xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}`} title="프로그램으로" />

      {/* 퀴즈 헤더 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
        <h1 className="text-2xl font-medium text-gray-800 mb-1">📝 {quiz.title}</h1>
        {quiz.description && (
          <p className="text-sm text-gray-600 mb-2 whitespace-pre-wrap">{quiz.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          <span>문제 {questions.length}개</span>
          {(quiz.start_at || quiz.due_at) && (
            <span className={`inline-flex items-center gap-1 ${isExpired ? 'text-red-500' : isNotStarted ? 'text-amber-600' : ''}`}>
              <Clock className="w-3.5 h-3.5" />
              {isExpired
                ? '마감됨'
                : isNotStarted
                  ? `${formatKoreanDateTime(quiz.start_at)} 시작 예정`
                  : quiz.due_at ? `~ ${formatKoreanDateTime(quiz.due_at)}` : '기한 없음'}
            </span>
          )}
        </div>
      </div>

      {/* 제출 완료 — 결과 요약 */}
      {isSubmitted && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 mb-4 text-center"
        >
          <Trophy className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          {my_submission.status === 'PENDING' ? (
            <>
              <p className="text-lg font-medium text-emerald-800">제출 완료!</p>
              <p className="text-sm text-emerald-700 mt-1">
                서술형 문항은 운영자 채점 후 점수가 확정돼요 (현재 {my_submission.total_score}점)
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-emerald-700">{my_submission.total_score}점</p>
              <p className="text-sm text-emerald-700 mt-1">채점 완료 · 점수가 랭킹에 반영됐어요</p>
            </>
          )}
        </motion.div>
      )}

      {/* 문제 목록 */}
      <div className="space-y-3">
        {questions.map((q, idx) => {
          const myAns = answerMap[q.id]
          return (
            <div key={q.id} className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="font-medium text-gray-800">
                  <span className="text-gray-400 mr-1">{idx + 1}.</span>
                  {q.question_text}
                </p>
                <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">{q.point}점</span>
              </div>

              {/* ─── 제출 전: 입력 폼 (시작 후 + 기한 내) ─── */}
              {!isSubmitted && !isExpired && !isNotStarted && (
                <QuestionInput q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
              )}

              {/* ─── 시작 전 ─── */}
              {!isSubmitted && isNotStarted && (
                <p className="text-sm text-amber-600">⏳ 아직 시작 전이에요</p>
              )}

              {/* ─── 마감됐는데 미제출 ─── */}
              {!isSubmitted && isExpired && (
                <p className="text-sm text-gray-400">마감된 퀴즈예요</p>
              )}

              {/* ─── 제출 후: 결과 ─── */}
              {isSubmitted && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 flex-shrink-0">내 답:</span>
                    <span className="text-gray-800">{displayAnswer(q, myAns?.answer)}</span>
                    {/* 정오 표시 (자동 채점된 경우만) */}
                    {myAns?.is_correct === true && <Check className="w-4 h-4 text-emerald-500" />}
                    {myAns?.is_correct === false && <X className="w-4 h-4 text-red-500" />}
                    {myAns?.is_correct === null && (
                      <span className="text-xs text-amber-600">채점 대기</span>
                    )}
                  </div>
                  {/* 정답 공개 시 */}
                  {quiz.reveal_answers && q.correct_answer != null && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 flex-shrink-0">정답:</span>
                      <span className="text-emerald-700 font-medium">{displayAnswer(q, q.correct_answer)}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">획득 {myAns?.awarded_point ?? 0}점</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {submitError && (
        <p className="mt-4 p-2 bg-red-100 text-red-700 rounded text-sm text-center">{submitError}</p>
      )}

      {/* 제출 버튼 (미제출 + 기한 내 + 시작됨) */}
      {!isSubmitted && !isExpired && !isNotStarted && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 pt-2 bg-gradient-to-t from-white via-white to-transparent">
          <div className="max-w-2xl mx-auto">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="w-full py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-2xl shadow-md shadow-emerald-200/40 transition disabled:bg-gray-400"
            >
              {submitMutation.isPending ? '제출 중...' : '제출하기'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 문제 유형별 입력 ─────────────────────────────────────
function QuestionInput({ q, value, onChange }) {
  if (q.type === 'MULTIPLE') {
    return (
      <div className="space-y-2">
        {(q.options || []).map((opt, oIdx) => {
          const selected = value === String(oIdx)
          return (
            <button
              key={oIdx}
              type="button"
              onClick={() => onChange(String(oIdx))}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-left text-sm transition
                ${selected ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
            >
              <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`} />
              {opt}
            </button>
          )
        })}
      </div>
    )
  }

  if (q.type === 'OX') {
    return (
      <div className="flex gap-2">
        {['O', 'X'].map(v => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex-1 py-2.5 text-lg font-bold rounded-lg border-2 transition
              ${value === v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
          >
            {v === 'O' ? '⭕ O' : '❌ X'}
          </button>
        ))}
      </div>
    )
  }

  // SHORT
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="답을 입력해주세요"
      className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 text-sm"
    />
  )
}

export default QuizSolvePage
