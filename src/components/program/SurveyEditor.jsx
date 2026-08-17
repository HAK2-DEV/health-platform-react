import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react'
import { queryKeys, saveProgramSurvey } from '../../lib/queries'
import { getProgramSurvey } from '../../lib/surveyDefaults'

const nid = () => 'q_' + Math.random().toString(36).slice(2, 8)

// 설문 문항 편집 본체(공용) — 마법사 모달 / 통계 편집 페이지에서 재사용.
//   props: program{ id, categories, theme, survey_questions }, responseCount, onDone(questions|null)
export default function SurveyEditor({ program, responseCount = 0, onDone }) {
  const queryClient = useQueryClient()
  const [questions, setQuestions] = useState(() => getProgramSurvey(program).map((q) => ({ ...q, id: q.id || nid() })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const setQ = (i, key, val) => setQuestions((qs) => qs.map((q, idx) => idx === i ? { ...q, [key]: val } : q))
  const move = (i, dir) => setQuestions((qs) => {
    const j = i + dir
    if (j < 0 || j >= qs.length) return qs
    const next = qs.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })
  const remove = (i) => setQuestions((qs) => qs.filter((_, idx) => idx !== i))
  const add = (type) => setQuestions((qs) => [...qs, type === 'scale'
    ? { id: nid(), type: 'scale', q: '', min: 1, max: 5, minLabel: '', maxLabel: '' }
    : { id: nid(), type: 'text', q: '' }])

  const save = async () => {
    if (questions.length === 0) { setError('문항을 최소 1개 이상 만들어주세요'); return }
    if (questions.some((q) => !q.q.trim())) { setError('빈 질문이 있어요. 모두 채워주세요'); return }
    setSaving(true); setError(null)
    try {
      const clean = questions.map((q) => q.type === 'scale'
        ? { id: q.id, type: 'scale', q: q.q.trim(), min: 1, max: 5, minLabel: (q.minLabel || '').trim(), maxLabel: (q.maxLabel || '').trim() }
        : { id: q.id, type: 'text', q: q.q.trim() })
      await saveProgramSurvey({ programId: program.id, questions: clean })
      queryClient.invalidateQueries({ queryKey: queryKeys.program(program.id) })
      onDone?.(clean)
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const resetDefault = async () => {
    if (!window.confirm('기본 문항으로 되돌릴까요? 지금까지 편집한 커스텀 문항은 사라져요.')) return
    setSaving(true); setError(null)
    try {
      await saveProgramSurvey({ programId: program.id, questions: null })
      queryClient.invalidateQueries({ queryKey: queryKeys.program(program.id) })
      onDone?.(null)
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-[14px] focus:border-emerald-400 outline-none'

  return (
    <div>
      {responseCount > 0 && (
        <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[12px] text-amber-800 leading-snug break-keep">
          ⚠️ 이미 <b>{responseCount}명</b>이 응답했어요. 문항을 바꾸면 기존 응답과 어긋날 수 있으니 되도록 시작 전에 편집하세요.
        </div>
      )}

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">{q.type === 'scale' ? '척도 1~5' : '단답'}</span>
              <span className="text-[11px] text-gray-400">문항 {i + 1}</span>
              <div className="ml-auto flex items-center gap-0.5">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center"><ArrowUp className="w-4 h-4" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === questions.length - 1} className="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center"><ArrowDown className="w-4 h-4" /></button>
                <button type="button" onClick={() => remove(i)} className="w-8 h-8 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <textarea value={q.q} onChange={(e) => setQ(i, 'q', e.target.value)} rows={2} placeholder="질문을 입력하세요 (예: 요즘 실천 정도는 어떤가요?)"
              className={`${inputCls} resize-none`} />
            {q.type === 'scale' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input value={q.minLabel || ''} onChange={(e) => setQ(i, 'minLabel', e.target.value)} placeholder="1점 라벨 (예: 거의 못 함)" className={inputCls} />
                <input value={q.maxLabel || ''} onChange={(e) => setQ(i, 'maxLabel', e.target.value)} placeholder="5점 라벨 (예: 매우 잘 함)" className={inputCls} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <button type="button" onClick={() => add('text')} className="flex-1 h-11 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 text-[13px] font-semibold hover:border-emerald-400 hover:text-emerald-600 transition inline-flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> 단답 문항</button>
        <button type="button" onClick={() => add('scale')} className="flex-1 h-11 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 text-[13px] font-semibold hover:border-emerald-400 hover:text-emerald-600 transition inline-flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> 척도 문항</button>
      </div>

      {error && <p className="mt-3 p-2 bg-red-100 text-red-700 rounded-xl text-sm text-center">{error}</p>}

      <div className="mt-5 flex gap-2">
        <button type="button" onClick={resetDefault} disabled={saving} className="px-4 h-12 rounded-xl bg-gray-100 text-gray-500 text-[14px] font-semibold disabled:opacity-50">기본 문항으로</button>
        <button type="button" onClick={save} disabled={saving} className="flex-1 h-12 rounded-xl bg-emerald-500 text-white text-[15px] font-bold active:scale-[0.98] transition disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
      </div>
    </div>
  )
}
