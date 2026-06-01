import { useState, useEffect, useRef } from 'react'
import Modal from '../common/Modal'
import { supabase } from '../../supabaseClient'

// 퀴즈 메타 수정 (제목/설명/기한/정답공개)
// 문제 수정은 답안에 영향이 커서 지원하지 않음 — 문제 변경 시 퀴즈 삭제 후 재생성 권장.
//
// props:
//   quiz: { id, title, description, start_at, due_at, reveal_answers }
//   isOpen, onClose, onSuccess()
function QuizEditModal({ quiz, isOpen, onClose, onSuccess }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startAt, setStartAt] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [revealAnswers, setRevealAnswers] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const dueAtRef = useRef(null)

  // datetime-local 형식: 'YYYY-MM-DDTHH:mm' — ISO 에서 잘라냄 (timezone 영향 회피)
  const isoToLocal = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    // 로컬 시각 기준 YYYY-MM-DDTHH:mm
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  useEffect(() => {
    if (quiz && isOpen) {
      setTitle(quiz.title || '')
      setDescription(quiz.description || '')
      setStartAt(isoToLocal(quiz.start_at))
      setDueAt(isoToLocal(quiz.due_at))
      setRevealAnswers(!!quiz.reveal_answers)
      setError(null)
      setIsSaving(false)
    }
  }, [quiz, isOpen])

  const handleStartChange = (e) => {
    setStartAt(e.target.value)
    if (e.target.value) {
      requestAnimationFrame(() => {
        try { dueAtRef.current?.showPicker?.() } catch {}
      })
    }
  }

  const handleSave = async () => {
    if (!title.trim()) { setError('퀴즈 제목을 입력해주세요'); return }
    if (startAt && dueAt && new Date(startAt) >= new Date(dueAt)) {
      setError('종료일은 시작일 이후여야 해요')
      return
    }
    setIsSaving(true)
    setError(null)

    const { error: updErr } = await supabase
      .from('quizzes')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        start_at: startAt ? new Date(startAt).toISOString() : null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        reveal_answers: revealAnswers,
      })
      .eq('id', quiz.id)

    if (updErr) {
      console.error('퀴즈 수정 실패:', updErr)
      setError(updErr.message)
      setIsSaving(false)
      return
    }

    onSuccess?.()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {quiz && (
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-1 pr-8">
            ✏️ 퀴즈 수정
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            제목·기한·정답 공개만 수정 가능. 문제 변경은 새 퀴즈로 만들어주세요.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                disabled={isSaving}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">설명 (선택)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                disabled={isSaving}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">풀이 기한 (선택)</label>
              <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                <div className="w-full sm:flex-1 min-w-0">
                  <p className="text-[11px] text-gray-500 mb-1">📅 시작</p>
                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={handleStartChange}
                    disabled={isSaving}
                    className="block w-full min-w-0 px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
                  />
                </div>
                <span className="hidden sm:inline text-gray-400 flex-shrink-0 pb-2">~</span>
                <div className="w-full sm:flex-1 min-w-0">
                  <p className="text-[11px] text-gray-500 mb-1">📅 종료</p>
                  <input
                    ref={dueAtRef}
                    type="datetime-local"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    min={startAt || undefined}
                    disabled={isSaving}
                    className="block w-full min-w-0 px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
                  />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={revealAnswers}
                onChange={(e) => setRevealAnswers(e.target.checked)}
                disabled={isSaving}
                className="w-4 h-4 accent-emerald-500"
              />
              <span className="text-sm text-gray-700">제출 후 참가자에게 정답 공개</span>
            </label>
          </div>

          {error && (
            <p className="mt-3 p-2 bg-red-100 text-red-700 rounded text-sm text-center">
              {error}
            </p>
          )}

          <div className="flex gap-2 mt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-[2] px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-md transition disabled:bg-gray-400"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default QuizEditModal
