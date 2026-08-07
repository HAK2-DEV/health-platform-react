import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  queryKeys,
  fetchProgram,
  fetchProgramQuizStats,
} from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'
import { Reveal, CountUp, useCountUp } from '../../components/program/statsAnim'

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

  return (
    <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
      <StickyBackBar
        fallbackPath={`/programs/${id}/stats`}
        title="통계로"
        breadcrumb={[program.name, '통계', '퀴즈']}
      />

      {totalQuizzes === 0 ? (
        <EmptyState
          icon="/icons/feature/quiz-empty.png"
          title="아직 만든 퀴즈가 없어요"
          description="아래 버튼으로 첫 퀴즈를 만들어보세요"
          action={{ label: '+ 새 퀴즈 만들기', onClick: () => navigate(`/programs/${id}/posts/quiz/new`) }}
        />
      ) : (
        <div className="space-y-3">
          {/* 상단 통계 박스 2개 */}
          <Reveal index={0}>
            <div className="grid grid-cols-2 gap-2.5 mt-2">
              <div className="bg-white border border-gray-200 rounded-2xl" style={{ padding: '18px 14px' }}>
                <p className="text-[10.5px] font-medium text-gray-400" style={{ lineHeight: 1, marginBottom: 8 }}>전체 퀴즈</p>
                <p className="text-[19px] font-extrabold text-gray-900" style={{ lineHeight: 1 }}><CountUp value={totalQuizzes} /><span className="text-[10.5px] font-bold text-gray-400 ml-0.5">개</span></p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl" style={{ padding: '18px 14px' }}>
                <p className="text-[10.5px] font-medium text-gray-400" style={{ lineHeight: 1, marginBottom: 8 }}>누적 제출</p>
                <p className="text-[19px] font-extrabold text-gray-900" style={{ lineHeight: 1 }}><CountUp value={totalSubmissions} /><span className="text-[10.5px] font-bold text-gray-400 ml-0.5">건</span></p>
              </div>
            </div>
          </Reveal>

          {/* 퀴즈별 카드 */}
          {stats.map((q, i) => {
            const isExpired = q.due_at && new Date(q.due_at) < new Date()
            const rateColor = q.participationRate >= 50 ? '#10b981' : '#f59e0b'
            const lowParticipation = q.participantCount > 0 && q.participationRate < 50
            return (
              <Reveal key={q.id} index={i + 1}>
                <button
                  type="button"
                  onClick={() => navigate(`/programs/${id}/posts/quiz/${q.id}`)}
                  className="w-full bg-white border border-gray-200 rounded-2xl p-5 hover:border-emerald-300 transition text-left"
                >
                  {/* 제목 + 배지 */}
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-base font-bold text-gray-800 flex-1 min-w-0 truncate">{q.title}</h3>
                    {q.correctRate !== null && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 flex-shrink-0">자동 채점</span>
                    )}
                    {q.pendingCount > 0 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex-shrink-0">대기 {q.pendingCount}</span>
                    )}
                    {isExpired && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">마감</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </div>

                  {/* 참여율 도넛 + 제출/평균 */}
                  <div className="flex items-center gap-5 mb-4">
                    <QuizDonut pct={q.participationRate} hex={rateColor} />
                    <div className="flex-1 min-w-0 space-y-3">
                      <MetricRow label="제출한 참여자" value={q.submissionCount} den={`/ ${q.participantCount}명`} />
                      <MetricRow label="평균 점수" value={q.avgScore} den={`/ ${q.totalPoints}점`} />
                    </div>
                  </div>

                  {/* 정답률 + 문제 수 — 패딩 16px, 라벨↔숫자 8px, 숫자↔바 16px(바 아래로). inline 으로 확실히 */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-gray-50 rounded-xl" style={{ padding: 16 }}>
                      <p className="text-[10.5px] font-medium text-gray-400" style={{ lineHeight: 1, marginBottom: 8 }}>정답률</p>
                      {q.correctRate !== null ? (
                        <>
                          <p className="text-[19px] font-extrabold text-gray-900" style={{ lineHeight: 1, marginBottom: 16 }}>{q.correctRate}%</p>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${q.correctRate}%`, background: rateColor }} />
                          </div>
                        </>
                      ) : (
                        <p className="text-[13px] text-gray-400" style={{ lineHeight: 1 }}>집계 불가</p>
                      )}
                    </div>
                    <div className="bg-gray-50 rounded-xl" style={{ padding: 16 }}>
                      <p className="text-[10.5px] font-medium text-gray-400" style={{ lineHeight: 1, marginBottom: 8 }}>문제 수</p>
                      <p className="text-[19px] font-extrabold text-gray-900" style={{ lineHeight: 1, marginBottom: 8 }}>{q.questionCount}<span className="text-[10.5px] font-bold text-gray-400 ml-0.5">개</span></p>
                      <p className="text-[10.5px] text-gray-400" style={{ lineHeight: 1 }}>총 {q.questionCount}문항</p>
                    </div>
                  </div>
                </button>

                {/* 참여율 낮음 넛지 — 리마인드 유도 */}
                {lowParticipation && (
                  <div className="mt-2 bg-amber-50/70 rounded-2xl p-4">
                    <p className="text-[13px] text-gray-600 leading-relaxed flex gap-2">
                      <span className="flex-shrink-0">💡</span>
                      <span>참여율이 <b className="text-amber-700">{q.participationRate}%</b>로 낮아요. 챌린지 공지나 응원 메시지로 퀴즈를 다시 알려보세요.</span>
                    </p>
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/programs/${id}?tab=community`)}
                        className="text-[13px] font-bold text-amber-700 inline-flex items-center gap-1 hover:text-amber-800"
                      >
                        리마인드 보내기 →
                      </button>
                    </div>
                  </div>
                )}
              </Reveal>
            )
          })}

          {/* 새 퀴즈 만들기 */}
          <button
            type="button"
            onClick={() => navigate(`/programs/${id}/posts/quiz/new`)}
            className="w-full h-12 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 font-bold text-sm hover:border-emerald-300 hover:text-emerald-600 transition"
          >
            + 새 퀴즈 만들기
          </button>
        </div>
      )}
    </div>
  )
}

// 참여율 도넛 (라벨 내장) — 뷰 진입 시 카운트업
function QuizDonut({ pct, hex }) {
  const [ref, n] = useCountUp(pct)
  const s = 84, sw = 9, r = (s - sw) / 2, c = 2 * Math.PI * r
  const off = c * (1 - Math.min(100, Math.max(0, n)) / 100)
  return (
    <svg ref={ref} viewBox={`0 0 ${s} ${s}`} width={s} height={s} className="flex-shrink-0">
      <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke="#eef0f0" strokeWidth={sw} />
      <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke={hex} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${s / 2} ${s / 2})`} />
      <text x={s / 2} y={s / 2 - 4} textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="800" fill="#111827">{Math.round(n)}%</text>
      <text x={s / 2} y={s / 2 + 13} textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700" fill="#9ca3af">참여율</text>
    </svg>
  )
}

// 도넛 옆 지표 행 — 라벨 + 값(분모)
function MetricRow({ label, value, den }) {
  return (
    <div>
      <p className="text-[12px] text-gray-400" style={{ lineHeight: 1, marginBottom: 8 }}>{label}</p>
      <p className="text-[18px] font-bold text-gray-900" style={{ lineHeight: 1 }}>
        {value}<span className="text-[13px] font-medium text-gray-400 ml-0.5">{den}</span>
      </p>
    </div>
  )
}

export default ProgramStatsQuizzesPage
