import { useState } from 'react'
import { ChevronDown, Check, X } from 'lucide-react'
import { formatKstStamp } from '../../lib/formatters'

// 유저 퀴즈 목록 — 퀴즈별 점수/정답률 + 탭하면 문항별 답안(정답/오답·해설) 딥드릴.
//   quizzes: fetchUserQuizDetail 결과 (answers 포함). 운영자·참가자 화면 공용.
export default function UserQuizList({ quizzes }) {
  const [open, setOpen] = useState(null)   // 펼친 submission id
  return (
    <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
      {quizzes.map(q => {
        const expanded = open === q.id
        return (
          <div key={q.id}>
            <button type="button" onClick={() => setOpen(o => o === q.id ? null : q.id)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition active:bg-gray-100">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{q.title}</p>
                <p className="text-[12px] text-gray-400 mt-0.5">
                  {q.status === 'PENDING' ? '채점 대기' : `정답 ${q.correct}/${q.answered}`}
                  {q.submitted_at ? ` · ${formatKstStamp(q.submitted_at)}` : ''}
                </p>
              </div>
              <span className="text-base font-bold text-emerald-600 flex-shrink-0">+{q.total_score}P</span>
              <ChevronDown className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
            {expanded && (
              <div className="bg-gray-50/60 px-4 pb-3 pt-1 space-y-2.5">
                {!q.reveal && (
                  <p className="text-[12.5px] text-gray-500 font-medium bg-gray-100 rounded-lg px-2.5 py-1.5 mb-1.5 flex items-center gap-1">🔒 정답·해설은 퀴즈 마감 후 공개돼요</p>
                )}
                {(q.answers || []).length === 0 ? (
                  <p className="text-[12px] text-gray-400 py-2">문항 정보가 없어요</p>
                ) : q.answers.map((a, i) => {
                  const pending = a.isCorrect === null || a.isCorrect === undefined
                  return (
                    <div key={i} className="border-l-2 pl-3 py-0.5" style={{ borderColor: pending ? '#e5e7eb' : (a.isCorrect ? '#a7f3d0' : '#fecaca') }}>
                      <div className="flex items-start gap-1.5">
                        <span className="mt-0.5 flex-shrink-0">
                          {pending ? <span className="text-[11px] text-gray-400">…</span>
                            : a.isCorrect ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-red-400" />}
                        </span>
                        <p className="text-[12.5px] font-medium text-gray-700 flex-1 min-w-0">{i + 1}. {a.text}</p>
                        <span className="text-[11px] font-bold text-gray-400 flex-shrink-0">{a.awarded}/{a.point}P</span>
                      </div>
                      <p className="text-[11.5px] text-gray-500 mt-1 pl-5 break-words">내 답: <b className={a.isCorrect ? 'text-emerald-600' : 'text-gray-700'}>{a.userAnswer || '(무응답)'}</b></p>
                      {!pending && !a.isCorrect && a.correctAnswer && (
                        <p className="text-[11.5px] text-emerald-600 mt-0.5 pl-5 break-words">정답: {a.correctAnswer}</p>
                      )}
                      {a.explanation && (
                        <p className="text-[11px] text-gray-400 mt-0.5 pl-5 break-words leading-snug">💡 {a.explanation}</p>
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
  )
}
