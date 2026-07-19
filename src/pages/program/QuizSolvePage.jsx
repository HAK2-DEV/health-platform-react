import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Check, X, Clock, Trophy, Eye, Circle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  queryKeys,
  fetchQuizForParticipant,
  fetchProgram,
  submitQuiz,
} from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import ConfirmModal from '../../components/common/ConfirmModal'
import Confetti from '../../components/common/Confetti'
import SubmitCelebration from '../../components/common/SubmitCelebration'
import { primeAudio } from '../../lib/sound'
import { formatKoreanDateTime } from '../../lib/formatters'
import { PROGRAM_THEME } from '../../lib/constants'

// 참가자 퀴즈 풀이/결과 페이지
// 라우트: /programs/:id/quiz/:quizId
//   미제출 → 풀이 폼 / 제출 완료 → 결과 (점수 + 정답공개 시 정오)
function QuizSolvePage() {
  const { id, quizId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isPreview = searchParams.get('preview') === '1'  // 운영자 미리보기 — 읽기전용, 제출 차단
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.quizDetail(quizId, userId),
    queryFn: () => fetchQuizForParticipant(quizId),
    enabled: !!quizId && !!userId,
  })

  // 달리기 테마 — 한 문제씩(스텝퍼) 풀이
  const { data: program } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!id,
  })
  const isRunning = program?.theme === PROGRAM_THEME.RUNNING
  // 카드홈(신규 표준) 도 달리기식 결과 화면(정답보기 팝업 + 버튼 + 제출 연출) 사용
  const isCardHome = program?.card_home === true && program?.theme !== PROGRAM_THEME.RUNNING && program?.theme !== PROGRAM_THEME.QUIT_SMOKING
  const cardHome = isRunning || isCardHome

  const [answers, setAnswers] = useState({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [submitError, setSubmitError] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)  // 미응답 제출 확인 모달
  const [resultOpen, setResultOpen] = useState(false)    // 정답 보기 모달
  const [celebrated, setCelebrated] = useState(false)    // 제출 완료 연출 재생 여부

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
      queryClient.invalidateQueries({ queryKey: ['home-stats'] })  // 대시보드 「오늘의 활동」 획득 점수 즉시 갱신
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
    primeAudio()   // 사용자 제스처에서 오디오 잠금 해제(모바일) → 제출 완료 효과음 재생 보장
    if (unanswered > 0) { setConfirmOpen(true); return }
    submitMutation.mutate()
  }
  const confirmSubmit = () => { primeAudio(); setConfirmOpen(false); submitMutation.mutate() }
  const unansweredModal = (
    <ConfirmModal
      isOpen={confirmOpen}
      onClose={() => setConfirmOpen(false)}
      onConfirm={confirmSubmit}
      title="제출할까요?"
      message={`아직 답하지 않은 문제가 ${unanswered}개 있어요.\n제출하면 더 이상 수정할 수 없어요.`}
      confirmLabel="제출하기"
      busy={submitMutation.isPending}
    />
  )

  // 달리기 테마 — 활성 풀이 상태(미제출·시작됨·기한 내)는 한 문제씩 스텝퍼로
  if (isRunning && !isPreview && !isSubmitted && !isExpired && !isNotStarted && questions.length > 0) {
    return (
      <>
        <QuizStepper
          quiz={quiz}
          questions={questions}
          answers={answers}
          setAnswer={setAnswer}
          currentIdx={Math.min(currentIdx, questions.length - 1)}
          setCurrentIdx={setCurrentIdx}
          onSubmit={handleSubmit}
          submitting={submitMutation.isPending}
          submitError={submitError}
          backPath={`/programs/${id}`}
        />
        {unansweredModal}
      </>
    )
  }

  // 달리기 + 카드홈 — 제출 완료(결과): 버튼 3개 + 정답 보기 중앙 팝업 (긴 스크롤 제거)
  if (cardHome && !isPreview && isSubmitted) {
    const rankingOn = program?.ranking_enabled !== false
    const sub = my_submission
    const amap = answerMap
    const pendingReview = sub.status === 'PENDING'
    const totalQ = questions.length
    const correctCount = questions.filter((q) => amap[q.id]?.is_correct === true).length
    const correctRate = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0
    // 방금 제출했으면(제출 성공) 3D 아이콘 연출 1회
    const showIntro = submitMutation.isSuccess && !celebrated
    return (
      <div className="px-4 pt-2 pb-10 max-w-2xl mx-auto">
        {showIntro && (
          <SubmitCelebration
            emptySrc="/icons/feature/quiz-empty.png" checkSrc="/icons/feature/quiz-check.png" checkOrigin="51% 51%"
            label="제출 완료!" points={sub.total_score || 0} pending={pendingReview}
            onDone={() => setCelebrated(true)} />
        )}
        <StickyBackBar fallbackPath={`/programs/${id}`} title="프로그램으로" />

        <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4 mb-[9px] flex items-center gap-3">
          <img src={QUIZ_ICON} alt="" aria-hidden="true" className="w-11 h-11 flex-shrink-0 object-contain" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          <div className="flex-1 min-w-0">
            <h1 className="text-[16px] font-bold text-gray-800 truncate">{quiz.title}</h1>
            {quiz.description && <p className="text-[12px] text-gray-400 truncate">{quiz.description}</p>}
          </div>
        </div>

        <div className="relative overflow-hidden bg-white border border-gray-100 rounded-2xl shadow-soft p-5 mb-[9px] space-y-4">
          <Confetti count={16} fall={300} />
          <div className="relative flex items-center gap-4">
            <motion.div
              className="text-5xl flex-shrink-0 select-none leading-none"
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: [0, 1.35, 0.92, 1.08, 1], rotate: [-25, 12, -6, 0] }}
              transition={{ duration: 0.9, delay: 0.12, times: [0, 0.4, 0.65, 0.85, 1], ease: 'easeOut' }}
            >
              🎉
            </motion.div>
            <div className="min-w-0">
              <h2 className="text-[21px] font-extrabold text-gray-900 leading-tight">제출 완료!</h2>
              {pendingReview ? (
                <p className="text-[12px] text-gray-500 mt-1 break-keep">
                  서술형 문항은 운영자 채점 후 점수가 확정돼요<br />(현재 {sub.total_score}점)
                </p>
              ) : (
                <p className="text-[12px] text-gray-500 mt-1 break-keep">
                  채점 완료 · <b className="text-emerald-600">{sub.total_score}점</b> 랭킹에 반영됐어요
                </p>
              )}
            </div>
          </div>
          {/* 통계 — 정답률 / 획득 예정 (제출완료 박스 안에 통합) */}
          <div className="relative grid grid-cols-2 gap-2">
            <StatTile icon={<Check className="w-4 h-4" strokeWidth={3} />} iconBg="bg-emerald-100 text-emerald-600" label="정답률" value={`${correctRate}%`} valueClass="text-emerald-600" />
            <StatTile icon={<Trophy className="w-4 h-4" />} iconBg="bg-amber-100 text-amber-500" label={pendingReview ? '획득 예정' : '획득 점수'} value={`+${sub.total_score}P`} valueClass="text-amber-600" />
          </div>
        </div>

        <div className="space-y-2">
          {rankingOn && (
            <button type="button" onClick={() => navigate(`/programs/${id}?tab=ranking`)}
              className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[14px] transition flex items-center justify-center gap-1">
              🏆 랭킹 보기
            </button>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setResultOpen(true)}
              className="flex-1 h-11 rounded-xl bg-white border border-emerald-300 text-emerald-600 font-bold text-[13px] hover:bg-emerald-50 transition flex items-center justify-center gap-1">
              📋 정답 보기
            </button>
            <button type="button" onClick={() => navigate(`/programs/${id}`)}
              className="flex-1 h-11 rounded-xl bg-white border border-gray-200 text-gray-500 font-bold text-[13px] hover:bg-gray-50 transition flex items-center justify-center gap-1">
              🏠 프로그램 돌아가기
            </button>
          </div>
        </div>

        {/* 정답 보기 — 중앙 팝업 (문항·정오) */}
        {resultOpen && (
          <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-5" onClick={() => setResultOpen(false)}>
            <div className="w-full max-w-md max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h4 className="text-[15px] font-bold text-gray-800">정답 보기</h4>
                <button type="button" onClick={() => setResultOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="닫기"><X className="w-5 h-5" /></button>
              </div>
              <div className="px-5 py-2">
                {questions.map((q, idx) => {
                  const myAns = amap[q.id]
                  return (
                    <div key={q.id} className="py-3 border-b border-gray-100 last:border-0">
                      <p className="text-[13px] font-bold text-gray-800 leading-snug break-keep"><span className="text-gray-400 mr-1">{idx + 1}.</span>{q.question_text}</p>
                      <div className="flex items-center gap-2 text-[13px] mt-1.5">
                        <span className="text-gray-500 flex-shrink-0">내 답</span>
                        <span className="text-gray-800">{displayAnswer(q, myAns?.answer)}</span>
                        {myAns?.is_correct === true && <Check className="w-4 h-4 text-emerald-500" />}
                        {myAns?.is_correct === false && <X className="w-4 h-4 text-rose-500" />}
                        {myAns?.is_correct === null && <span className="text-xs text-amber-600">채점 대기</span>}
                      </div>
                      {quiz.reveal_answers && q.correct_answer != null && (
                        <div className="flex items-center gap-2 text-[13px] mt-0.5"><span className="text-gray-500 flex-shrink-0">정답</span><span className="text-emerald-700 font-medium">{displayAnswer(q, q.correct_answer)}</span></div>
                      )}
                      {quiz.reveal_answers && q.explanation && (
                        <div className="flex items-start gap-1.5 text-[12px] bg-emerald-50/70 rounded-lg p-2 mt-1.5"><span>💡</span><span className="text-gray-700 leading-snug whitespace-pre-wrap break-keep">{q.explanation}</span></div>
                      )}
                      <p className="text-[11px] text-gray-400 mt-1">획득 {myAns?.awarded_point ?? 0}점</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-24 max-w-2xl mx-auto">
      <StickyBackBar fallbackPath={isPreview ? `/programs/${id}?tab=quizzes&panel=quiz` : `/programs/${id}`} title={isPreview ? '퀴즈 관리로' : '프로그램으로'} />

      {/* 미리보기 안내 — 상호작용/제출 차단 */}
      {isPreview && (
        <div className="flex items-center gap-2 mb-3 p-3 bg-sky-50 border border-sky-200 rounded-xl text-[12px] text-sky-700">
          <Eye className="w-4 h-4 flex-shrink-0" />
          <span>미리보기예요. 참가자에게 보이는 화면만 확인하며, <b>답 선택·제출은 되지 않아요.</b></span>
        </div>
      )}

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

      {/* 예정(미시작) — 참여자는 문항을 볼 수 없음. 시작 시각 안내 (운영자 미리보기 제외) */}
      {isNotStarted && !isPreview && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-2">📅</div>
          <p className="text-base font-bold text-amber-800 mb-1">아직 시작 전인 퀴즈예요</p>
          <p className="text-sm text-amber-700">{formatKoreanDateTime(quiz.start_at)}부터 풀 수 있어요.</p>
        </div>
      )}

      {/* 제출 완료 — 결과 요약 (미리보기 제외) */}
      {!isPreview && isSubmitted && (
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

      {/* 문제 목록 — 예정(미시작) 퀴즈는 참여자에게 가림(미리보기 제외) */}
      {!(isNotStarted && !isPreview) && (
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

              {/* ─── 미리보기: 일정·제출과 무관하게 입력 폼을 읽기전용으로 노출 ─── */}
              {isPreview && (
                <div className="pointer-events-none select-none">
                  <QuestionInput q={q} value={undefined} onChange={() => {}} />
                </div>
              )}

              {/* ─── 제출 전: 입력 폼 (시작 후 + 기한 내) ─── */}
              {!isPreview && !isSubmitted && !isExpired && !isNotStarted && (
                <QuestionInput q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
              )}

              {/* ─── 시작 전 ─── */}
              {!isPreview && !isSubmitted && isNotStarted && (
                <p className="text-sm text-amber-600">⏳ 아직 시작 전이에요</p>
              )}

              {/* ─── 마감됐는데 미제출 ─── */}
              {!isPreview && !isSubmitted && isExpired && (
                <p className="text-sm text-gray-400">마감된 퀴즈예요</p>
              )}

              {/* ─── 제출 후: 결과 ─── */}
              {!isPreview && isSubmitted && (
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
                  {/* 해설 (정답 공개 + 해설 있을 때) */}
                  {quiz.reveal_answers && q.explanation && (
                    <div className="flex items-start gap-1.5 text-sm bg-emerald-50/70 rounded-lg p-2 mt-1">
                      <span className="flex-shrink-0">💡</span>
                      <span className="text-gray-700 leading-snug whitespace-pre-wrap">{q.explanation}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">획득 {myAns?.awarded_point ?? 0}점</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
      )}

      {submitError && (
        <p className="mt-4 p-2 bg-red-100 text-red-700 rounded-xl text-sm text-center">{submitError}</p>
      )}

      {/* 제출 버튼 (미제출 + 기한 내 + 시작됨, 미리보기 제외) */}
      {!isPreview && !isSubmitted && !isExpired && !isNotStarted && (
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

      {unansweredModal}
    </div>
  )
}

// ─── 달리기 테마 — 한 문제씩 스텝퍼 ──────────────────────────
const QUIZ_ICON = '/icons/running/quiz.png'

function StatTile({ icon, iconBg, label, value, valueClass }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl p-2.5">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 leading-tight">{label}</p>
        <p className={`text-[14px] font-extrabold leading-tight truncate ${valueClass || 'text-gray-800'}`}>{value}</p>
      </div>
    </div>
  )
}

function MiniRing({ done, total }) {
  const pct = total > 0 ? done / total : 0
  const R = 22
  const C = 2 * Math.PI * R
  return (
    <div className="relative w-[52px] h-[52px] flex-shrink-0">
      <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
        <circle cx="28" cy="28" r={R} fill="none" stroke="#E5E7EB" strokeWidth="6" />
        <circle cx="28" cy="28" r={R} fill="none" stroke="#22A45C" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset 0.4s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[14px] font-extrabold text-gray-900 leading-none">{done}<span className="text-[11px] text-gray-400">/{total}</span></span>
      </div>
    </div>
  )
}

function QuizStepper({ quiz, questions, answers, setAnswer, currentIdx, setCurrentIdx, onSubmit, submitting, submitError, backPath }) {
  const total = questions.length
  const q = questions[currentIdx]
  const isLast = currentIdx === total - 1
  return (
    <div className="px-4 pt-2 pb-28 max-w-2xl mx-auto">
      <StickyBackBar fallbackPath={backPath} title="프로그램으로" />

      {/* 헤더 — 아이콘 + 제목/설명 + 진행 링 */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4 mb-[9px] flex items-center gap-3">
        <img src={QUIZ_ICON} alt="" aria-hidden="true" className="w-11 h-11 flex-shrink-0 object-contain" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        <div className="flex-1 min-w-0">
          <h1 className="text-[16px] font-bold text-gray-800 truncate">{quiz.title}</h1>
          {quiz.description && <p className="text-[12px] text-gray-400 truncate">{quiz.description}</p>}
        </div>
        <MiniRing done={currentIdx + 1} total={total} />
      </div>

      {/* 문제 카드 — 한 문제씩, 좌우 슬라이드 전환 */}
      <motion.div
        key={q.id}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[12px] font-extrabold">Q{currentIdx + 1}</span>
          <span className="text-[12px] text-gray-400">{q.point}점</span>
        </div>
        <p className="text-[15px] font-bold text-gray-800 leading-snug mb-4 whitespace-pre-wrap break-keep">{q.question_text}</p>
        <QuestionInput q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
      </motion.div>

      {submitError && (
        <p className="mt-3 p-2 bg-red-100 text-red-700 rounded-xl text-sm text-center">{submitError}</p>
      )}

      {/* 하단 고정 — 이전 / 다음·답안 제출 */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 pt-3 bg-gradient-to-t from-white via-white to-transparent">
        <div className="max-w-2xl mx-auto flex gap-2">
          {currentIdx > 0 && (
            <button type="button" onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              className="px-5 h-12 rounded-xl border border-gray-200 text-gray-500 font-bold text-[14px] hover:bg-gray-50 transition">
              이전
            </button>
          )}
          {!isLast ? (
            <button type="button" onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
              className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[15px] transition">
              다음
            </button>
          ) : (
            <button type="button" onClick={onSubmit} disabled={submitting}
              className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[15px] transition disabled:opacity-60">
              {submitting ? '제출 중...' : '답안 제출'}
            </button>
          )}
        </div>
      </div>
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
    const opts = [
      { v: 'O', Icon: Circle, ic: 'text-emerald-500', base: 'bg-emerald-50', sel: 'bg-emerald-100 ring-2 ring-emerald-400' },
      { v: 'X', Icon: X, ic: 'text-rose-500', base: 'bg-rose-50', sel: 'bg-rose-100 ring-2 ring-rose-400' },
    ]
    return (
      <div className="flex gap-2">
        {opts.map(({ v, Icon, ic, base, sel }) => {
          const selected = value === v
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={`flex-1 h-14 rounded-2xl flex items-center justify-center transition ${selected ? sel : `${base} hover:brightness-95`}`}
            >
              <Icon className={`w-7 h-7 ${ic}`} strokeWidth={3} />
            </button>
          )
        })}
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
