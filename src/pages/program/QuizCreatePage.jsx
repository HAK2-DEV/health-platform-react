import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { queryKeys } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'

// 퀴즈 생성 페이지 — 운영자 전용
// 라우트: /programs/:id/posts/quiz/new
//   제목/설명/기한/정답공개 + 문제 동적 추가 (객관식/서술형/OX)
//   문제별 점수 + award_mode(맞추면/틀려도) + grading_mode(서술형 자동/수동)
//   저장: quizzes INSERT → quiz_questions bulk INSERT

const QUESTION_TYPES = [
  { value: 'MULTIPLE', label: '객관식', emoji: '🔢' },
  { value: 'OX', label: 'OX', emoji: '⭕' },
  { value: 'SHORT', label: '서술형', emoji: '✍️' },
]

// 새 문제 기본값
const newQuestion = (type = 'MULTIPLE') => ({
  type,
  question_text: '',
  point: 10,
  award_mode: 'CORRECT_ONLY',
  grading_mode: 'AUTO',
  options: ['', ''],
  correctIndex: 0,
  oxAnswer: 'O',
  shortAnswer: '',
})

function QuizCreatePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startAt, setStartAt] = useState('')
  const [dueAt, setDueAt] = useState('')
  const dueAtRef = useRef(null)

  // 시작일 선택 직후 종료일 picker 자동 오픈 (Chrome/Edge/Firefox 모두 showPicker 지원)
  //   onChange 는 user gesture 컨텍스트라 showPicker 호출 허용.
  const handleStartChange = (e) => {
    const v = e.target.value
    setStartAt(v)
    if (!v) return
    requestAnimationFrame(() => {
      try {
        dueAtRef.current?.showPicker?.()
      } catch {
        // 브라우저 미지원 → 사용자가 직접 클릭
      }
    })
  }

  // 종료일 선택 직후 picker 닫고 살짝 스크롤 — 다음 입력(정답 공개/문제)로 시선 유도
  const handleDueChange = (e) => {
    setDueAt(e.target.value)
    if (!e.target.value) return
    requestAnimationFrame(() => {
      try { dueAtRef.current?.blur?.() } catch {}
      window.scrollBy({ top: 400, behavior: 'smooth' })
    })
  }
  const [revealAnswers, setRevealAnswers] = useState(false)
  const [questions, setQuestions] = useState([newQuestion()])
  const [error, setError] = useState(null)

  // ─── 문제 조작 ───────────────────────────────────────
  const updateQuestion = (idx, patch) => {
    setQuestions(qs => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)))
  }
  const addQuestion = () => setQuestions(qs => [...qs, newQuestion()])
  const removeQuestion = (idx) => setQuestions(qs => qs.filter((_, i) => i !== idx))

  const updateOption = (qIdx, oIdx, value) => {
    setQuestions(qs => qs.map((q, i) => {
      if (i !== qIdx) return q
      const options = q.options.map((o, j) => (j === oIdx ? value : o))
      return { ...q, options }
    }))
  }
  const addOption = (qIdx) => {
    setQuestions(qs => qs.map((q, i) => (i === qIdx ? { ...q, options: [...q.options, ''] } : q)))
  }
  const removeOption = (qIdx, oIdx) => {
    setQuestions(qs => qs.map((q, i) => {
      if (i !== qIdx) return q
      const options = q.options.filter((_, j) => j !== oIdx)
      // 정답 인덱스 보정
      let correctIndex = q.correctIndex
      if (oIdx === correctIndex) correctIndex = 0
      else if (oIdx < correctIndex) correctIndex -= 1
      return { ...q, options, correctIndex }
    }))
  }

  // ─── 검증 + 저장 ─────────────────────────────────────
  const validate = () => {
    if (!title.trim()) return '퀴즈 제목을 입력해주세요'
    if (startAt && dueAt && new Date(startAt) >= new Date(dueAt)) {
      return '종료일은 시작일 이후여야 해요'
    }
    if (questions.length === 0) return '문제를 최소 1개 추가해주세요'
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const n = i + 1
      if (!q.question_text.trim()) return `${n}번 문제 내용을 입력해주세요`
      if (q.point < 0) return `${n}번 문제 점수는 0 이상이어야 해요`
      if (q.type === 'MULTIPLE') {
        const filled = q.options.filter(o => o.trim())
        if (filled.length < 2) return `${n}번 문제는 보기를 2개 이상 입력해주세요`
        if (!q.options[q.correctIndex]?.trim()) return `${n}번 문제의 정답 보기를 선택해주세요`
      }
      if (q.type === 'SHORT' && q.grading_mode === 'AUTO' && !q.shortAnswer.trim()) {
        return `${n}번 서술형(자동 채점)은 정답을 입력해주세요`
      }
    }
    return null
  }

  const computeCorrectAnswer = (q) => {
    if (q.type === 'MULTIPLE') return String(q.correctIndex)
    if (q.type === 'OX') return q.oxAnswer
    if (q.type === 'SHORT') return q.grading_mode === 'AUTO' ? q.shortAnswer.trim() : null
    return null
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      // 1) quizzes INSERT
      const { data: quiz, error: qErr } = await supabase
        .from('quizzes')
        .insert({
          program_id: id,
          title: title.trim(),
          description: description.trim() || null,
          start_at: startAt ? new Date(startAt).toISOString() : null,
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
          reveal_answers: revealAnswers,
          created_by: userId,
        })
        .select()
        .single()
      if (qErr) throw qErr

      // 2) quiz_questions bulk INSERT
      const rows = questions.map((q, idx) => ({
        quiz_id: quiz.id,
        type: q.type,
        question_text: q.question_text.trim(),
        options: q.type === 'MULTIPLE' ? q.options.filter(o => o.trim()) : null,
        correct_answer: computeCorrectAnswer(q),
        point: Number(q.point) || 0,
        award_mode: q.award_mode,
        grading_mode: q.type === 'SHORT' ? q.grading_mode : 'AUTO',
        order_index: idx,
      }))
      const { error: qqErr } = await supabase.from('quiz_questions').insert(rows)
      if (qqErr) {
        // 롤백 — 문제 INSERT 실패 시 quiz 제거 (orphan 방지)
        await supabase.from('quizzes').delete().eq('id', quiz.id)
        throw qqErr
      }
      return quiz
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programQuizzes(id) })
      navigate(`/programs/${id}/posts`)
    },
    onError: (err) => {
      console.error('퀴즈 생성 실패:', err)
      setError(err.message || '퀴즈 생성에 실패했어요')
    },
  })

  const handleSubmit = () => {
    const v = validate()
    if (v) { setError(v); return }
    setError(null)
    createMutation.mutate()
  }

  const totalPoint = questions.reduce((s, q) => s + (Number(q.point) || 0), 0)

  return (
    <div className="px-4 pt-2 pb-24 max-w-2xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/posts`} title="게시물 관리로" />

      <h1 className="text-2xl font-medium text-gray-800 mb-1">📝 퀴즈 만들기</h1>
      <p className="text-sm text-gray-500 mb-6">
        문제 {questions.length}개 · 총 {totalPoint}점
      </p>

      {/* 기본 정보 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 1주차 건강 상식 퀴즈"
            maxLength={60}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">설명 (선택)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="퀴즈 안내 문구"
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">풀이 기한 (선택)</label>
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={startAt}
              onChange={handleStartChange}
              className="flex-1 min-w-0 px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500"
              placeholder="시작"
            />
            <span className="text-gray-400 flex-shrink-0">~</span>
            <input
              ref={dueAtRef}
              type="datetime-local"
              value={dueAt}
              onChange={handleDueChange}
              min={startAt || undefined}
              className="flex-1 min-w-0 px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500"
              placeholder="종료"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            시작 비우면 즉시 시작 / 종료 비우면 무기한
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={revealAnswers}
            onChange={(e) => setRevealAnswers(e.target.checked)}
            className="w-4 h-4 accent-emerald-500"
          />
          <span className="text-sm text-gray-700">제출 후 참가자에게 정답 공개</span>
        </label>
      </div>

      {/* 문제 목록 */}
      <div className="space-y-4">
        {questions.map((q, idx) => (
          <QuestionEditor
            key={idx}
            index={idx}
            question={q}
            canRemove={questions.length > 1}
            onChange={(patch) => updateQuestion(idx, patch)}
            onRemove={() => removeQuestion(idx)}
            onUpdateOption={(oIdx, val) => updateOption(idx, oIdx, val)}
            onAddOption={() => addOption(idx)}
            onRemoveOption={(oIdx) => removeOption(idx, oIdx)}
          />
        ))}
      </div>

      {/* 문제 추가 */}
      <button
        type="button"
        onClick={addQuestion}
        className="w-full mt-4 flex items-center justify-center gap-1.5 py-3 border-2 border-dashed border-gray-300 hover:border-emerald-400 hover:bg-emerald-50/50 text-gray-600 hover:text-emerald-700 rounded-2xl transition"
      >
        <Plus className="w-4 h-4" />
        문제 추가
      </button>

      {error && (
        <p className="mt-4 p-2 bg-red-100 text-red-700 rounded text-sm text-center">{error}</p>
      )}

      {/* 저장 (하단 고정) */}
      <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 pt-2 bg-gradient-to-t from-white via-white to-transparent">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="w-full py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-2xl shadow-md shadow-emerald-200/40 transition disabled:bg-gray-400"
          >
            {createMutation.isPending ? '저장 중...' : '퀴즈 발행하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 문제 편집 카드 ─────────────────────────────────────
function QuestionEditor({ index, question: q, canRemove, onChange, onRemove, onUpdateOption, onAddOption, onRemoveOption }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <GripVertical className="w-4 h-4 text-gray-300" />
          문제 {index + 1}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-500 transition"
            title="문제 삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 유형 선택 */}
      <div className="flex gap-1.5 mb-3">
        {QUESTION_TYPES.map(t => {
          const active = q.type === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange({ type: t.value })}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg border-2 transition
                ${active ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              {t.emoji} {t.label}
            </button>
          )
        })}
      </div>

      {/* 문제 내용 */}
      <textarea
        value={q.question_text}
        onChange={(e) => onChange({ question_text: e.target.value })}
        rows={2}
        placeholder="문제를 입력해주세요"
        className="w-full px-3 py-2 mb-3 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 resize-none text-sm"
      />

      {/* 유형별 정답 입력 */}
      {q.type === 'MULTIPLE' && (
        <div className="space-y-2 mb-3">
          <p className="text-xs text-gray-500">보기 (정답을 선택하세요)</p>
          {q.options.map((opt, oIdx) => (
            <div key={oIdx} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${index}`}
                checked={q.correctIndex === oIdx}
                onChange={() => onChange({ correctIndex: oIdx })}
                className="w-4 h-4 accent-emerald-500 flex-shrink-0"
              />
              <input
                type="text"
                value={opt}
                onChange={(e) => onUpdateOption(oIdx, e.target.value)}
                placeholder={`보기 ${oIdx + 1}`}
                className="flex-1 px-3 py-1.5 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 text-sm"
              />
              {q.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => onRemoveOption(oIdx)}
                  className="p-1 text-gray-400 hover:text-red-500 transition flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={onAddOption}
            className="text-xs text-emerald-600 hover:text-emerald-700"
          >
            + 보기 추가
          </button>
        </div>
      )}

      {q.type === 'OX' && (
        <div className="flex gap-2 mb-3">
          {['O', 'X'].map(v => (
            <button
              key={v}
              type="button"
              onClick={() => onChange({ oxAnswer: v })}
              className={`flex-1 py-2 text-lg font-bold rounded-lg border-2 transition
                ${q.oxAnswer === v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
            >
              {v === 'O' ? '⭕ O' : '❌ X'}
            </button>
          ))}
        </div>
      )}

      {q.type === 'SHORT' && (
        <div className="mb-3 space-y-2">
          {/* 채점 방식 */}
          <div className="flex gap-1.5">
            {[
              { v: 'AUTO', label: '정답 일치 자동 채점' },
              { v: 'MANUAL', label: '운영자 수동 채점' },
            ].map(m => (
              <button
                key={m.v}
                type="button"
                onClick={() => onChange({ grading_mode: m.v })}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border-2 transition
                  ${q.grading_mode === m.v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {q.grading_mode === 'AUTO' && (
            <input
              type="text"
              value={q.shortAnswer}
              onChange={(e) => onChange({ shortAnswer: e.target.value })}
              placeholder="정답 (정확히 일치해야 정답 처리)"
              className="w-full px-3 py-1.5 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 text-sm"
            />
          )}
        </div>
      )}

      {/* 점수 + award_mode */}
      <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500">점수</label>
          <input
            type="number"
            min={0}
            value={q.point}
            onChange={(e) => onChange({ point: e.target.value })}
            className="w-16 px-2 py-1 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 text-sm text-center"
          />
        </div>
        <div className="flex gap-1.5 flex-1">
          {[
            { v: 'CORRECT_ONLY', label: '맞추면' },
            { v: 'ALWAYS', label: '틀려도' },
          ].map(a => (
            <button
              key={a.v}
              type="button"
              onClick={() => onChange({ award_mode: a.v })}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg border-2 transition
                ${q.award_mode === a.v ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
              {a.label} 지급
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default QuizCreatePage
