import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

// 참여 설문 시트 — 문항 유형(text·scale) 렌더 + 제출.
//   questions: [{ id, type:'text'|'scale', q, min?, max?, minLabel?, maxLabel? }]
export default function SurveySheet({ open, title = '시작 설문', questions = [], initial = null, onClose, onSubmit }) {
  const [ans, setAns] = useState(() => initial || {})
  useBodyScrollLock(open)
  const set = (id, v) => setAns((a) => ({ ...a, [id]: v }))
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(15,23,42,0.45)' }}
          onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-md bg-white rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}>
            <div className="flex items-center mb-1">
              <h3 className="text-[16px] font-extrabold text-gray-900">{title}</h3>
              <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto w-8 h-8 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[12px] text-gray-400 mb-4">잠깐이면 돼요 · 나중에 변화를 확인할 수 있어요</p>
            <div className="space-y-5">
              {questions.map((q) => (
                <div key={q.id}>
                  <p className="text-[14px] font-semibold text-gray-800 mb-2 break-keep">{q.q}</p>
                  {q.type === 'text' && (
                    <textarea value={ans[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} rows={2} placeholder="자유롭게 적어주세요"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[14px] resize-none focus:border-emerald-400 outline-none" />
                  )}
                  {q.type === 'scale' && (
                    <div>
                      <div className="flex gap-1.5">
                        {Array.from({ length: (q.max || 5) - (q.min || 1) + 1 }, (_, i) => (q.min || 1) + i).map((n) => (
                          <button type="button" key={n} onClick={() => set(q.id, n)}
                            className={`flex-1 h-10 rounded-lg text-[14px] font-bold border transition ${ans[q.id] === n ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-200 text-gray-600'}`}>{n}</button>
                        ))}
                      </div>
                      {(q.minLabel || q.maxLabel) && (
                        <div className="flex justify-between mt-1 text-[10.5px] text-gray-400"><span>{q.minLabel}</span><span>{q.maxLabel}</span></div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => onSubmit?.(ans)}
              className="mt-6 w-full h-12 rounded-xl bg-emerald-500 text-white text-[15px] font-bold active:scale-[0.98] transition">제출</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
