import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Trash2, Pencil, Check, ClipboardCheck } from 'lucide-react'
import { formatKoreanDateTime } from '../../lib/formatters'

// 달리기 전용 퀴즈 카드 — 번호·아이콘·제목·설명·문항 유형·점수 + 상태(시작/완료/채점중/예정/마감) + 운영자 수정/삭제.
const QUIZ_ICON = '/icons/feature/quiz.png'
const TYPE_LABEL = { MULTIPLE: '객관식', OX: 'OX', SHORT: '서술형' }
const TYPE_ORDER = ['MULTIPLE', 'OX', 'SHORT']

function typeChips(breakdown, questionCount) {
  const b = breakdown || {}
  const known = TYPE_ORDER.filter((t) => b[t] > 0).map((t) => `${TYPE_LABEL[t]} ${b[t]}`)
  const extra = Object.keys(b).filter((t) => !TYPE_ORDER.includes(t) && b[t] > 0).map((t) => `${t} ${b[t]}`)
  const chips = [...known, ...extra]
  return chips.length ? chips : [`${questionCount || 0}문제`]
}

function RunningQuizCard({ quiz, index = 0, programId, quizPreview, isOwner, onEdit, onDelete }) {
  const navigate = useNavigate()
  const [shake, setShake] = useState(false)
  const sub = quiz.mySubmission
  const now = new Date()
  const isNotStarted = quiz.start_at && new Date(quiz.start_at) > now
  const isExpired = quiz.due_at && new Date(quiz.due_at) < now
  const lockedNotStarted = isNotStarted && !quizPreview
  const done = !!sub && sub.status !== 'PENDING'
  const pending = !!sub && sub.status === 'PENDING'

  const open = () => {
    if (lockedNotStarted) { setShake(true); setTimeout(() => setShake(false), 600); return }
    navigate(`/programs/${programId}/quiz/${quiz.id}${quizPreview ? '?preview=1' : ''}`)
  }

  const renderAction = () => {
    if (done || pending) return null
    if (isNotStarted) return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[11px] rounded-md font-bold whitespace-nowrap">🔒 예정</span>
    if (isExpired) return <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] rounded-md font-bold whitespace-nowrap">마감</span>
    return (
      <button type="button" onClick={open}
        className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold rounded-lg whitespace-nowrap transition">
        {isOwner ? '미리보기' : '시작하기'}
      </button>
    )
  }

  return (
    <motion.div
      animate={shake ? { x: [0, -8, 8, -7, 7, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.5 }}
      className={`bg-white rounded-2xl shadow-soft border p-3.5 ${lockedNotStarted ? 'border-amber-200' : 'border-gray-100'}`}
    >
      <div className="flex gap-3">
        <img src={QUIZ_ICON} alt="" aria-hidden="true" className="w-14 h-14 flex-shrink-0 object-contain" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[12px] font-extrabold text-emerald-500 flex-shrink-0">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="text-[14px] font-bold text-gray-800 break-keep leading-snug truncate">{quiz.title}</h3>
            </div>
            <span className="text-[12px] font-extrabold text-emerald-600 whitespace-nowrap flex-shrink-0">+{quiz.totalPoint || 0}P</span>
          </div>
          {quiz.description && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug line-clamp-2 break-keep">{quiz.description}</p>}
          <div className="flex items-center justify-between gap-2 mt-2">
            {isNotStarted ? (
              <span className="text-[10.5px] text-gray-500 bg-gray-50 rounded px-1.5 py-0.5 truncate">예정 · {formatKoreanDateTime(quiz.start_at)}부터</span>
            ) : (
              <div className="flex flex-wrap items-center gap-1 min-w-0">
                {typeChips(quiz.typeBreakdown, quiz.questionCount).map((c, i) => (
                  <span key={i} className="text-[10.5px] text-gray-500 bg-gray-50 rounded px-1.5 py-0.5 whitespace-nowrap">{c}</span>
                ))}
              </div>
            )}
            <div className="flex-shrink-0">{renderAction()}</div>
          </div>
        </div>
      </div>

      {done && (
        <div className="mt-3 w-full h-9 rounded-lg bg-emerald-50 text-emerald-600 text-[12px] font-bold flex items-center justify-center gap-1">
          <Check className="w-4 h-4" strokeWidth={3} /> 완료 · {sub.total_score}점
        </div>
      )}
      {pending && (
        <div className="mt-3 w-full h-9 rounded-lg bg-amber-50 text-amber-700 text-[12px] font-bold flex items-center justify-center gap-1">
          ⏳ 채점 중
        </div>
      )}

      {isOwner && (
        <>
          {/* 결과·채점 — 운영자 핵심 동작, 전체폭으로 분리해 눈에 띄게 */}
          <button type="button" onClick={() => navigate(`/programs/${programId}/posts/quiz/${quiz.id}`)}
            className="mt-3 w-full h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-bold flex items-center justify-center gap-1.5 transition">
            <ClipboardCheck className="w-4 h-4" /> 제출 결과·채점
          </button>
          <div className="flex items-center justify-end gap-0.5 mt-2 pt-2 border-t border-gray-100">
          {onEdit && (
            <button type="button" onClick={() => onEdit(quiz)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition" title="퀴즈 수정">
              <Pencil className="w-3.5 h-3.5" /> 수정
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={() => onDelete(quiz)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition" title="퀴즈 삭제">
              <Trash2 className="w-3.5 h-3.5" /> 삭제
            </button>
          )}
          </div>
        </>
      )}
    </motion.div>
  )
}

export default RunningQuizCard
