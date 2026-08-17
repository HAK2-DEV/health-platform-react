import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { Reveal, CountUp, useInViewOnce, STATS_EASE } from './statsAnim'

// 설문 응답 집계 뷰(공통) — 척도: 평균 + 분포 막대 / 단답: 상위 5개 + 「전체 보기」 중앙 팝업.
//   props: questions[{id,type,q,min,max,minLabel,maxLabel}], responses[{answers:{qid:value}}]

const LI = 'text-[13px] text-gray-700 leading-snug break-keep [overflow-wrap:anywhere] whitespace-pre-wrap rounded-lg bg-gray-50 px-2.5 py-2'

function ScaleAgg({ q, vals }) {
  const min = q.min || 1, max = q.max || 5
  const nums = vals.filter((v) => typeof v === 'number')
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
  const counts = {}
  for (let i = min; i <= max; i++) counts[i] = 0
  nums.forEach((v) => { if (counts[v] != null) counts[v]++ })
  const maxCount = Math.max(1, ...Object.values(counts))
  const [barsRef, grown] = useInViewOnce()
  return (
    <div>
      <div className="flex items-baseline gap-1.5 mb-2.5">
        {nums.length
          ? <CountUp value={avg} duration={800} className="text-[22px] font-extrabold text-emerald-600 tabular-nums" format={(x) => x.toFixed(1)} />
          : <span className="text-[22px] font-extrabold text-emerald-600 tabular-nums">–</span>}
        <span className="text-[11px] text-gray-400">/ {max} 평균</span>
      </div>
      <div ref={barsRef} className="space-y-1.5">
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n, i) => (
          <div key={n} className="flex items-center gap-2">
            <span className="w-4 text-[11px] text-gray-500 tabular-nums text-right">{n}</span>
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: grown ? `${(counts[n] / maxCount) * 100}%` : '0%', transition: `width .55s ${STATS_EASE} ${i * 0.05}s` }} />
            </div>
            <span className="w-9 text-[11px] text-gray-500 tabular-nums text-right">{counts[n]}명</span>
          </div>
        ))}
      </div>
      {(q.minLabel || q.maxLabel) && (
        <div className="flex justify-between mt-1.5 text-[10px] text-gray-400"><span>{min} · {q.minLabel}</span><span>{q.maxLabel} · {max}</span></div>
      )}
    </div>
  )
}

// 단답 전체 응답 — 화면 중앙 팝업
function ResponsesModal({ open, title, vals, onClose }) {
  useBodyScrollLock(open)
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: 'rgba(15,23,42,0.45)' }}
          onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.34, 1.4, 0.64, 1] }}>
            <div className="flex items-start gap-2 px-5 py-4 border-b border-gray-100">
              <h3 className="flex-1 text-[15px] font-extrabold text-gray-900 break-keep leading-snug">{title}</h3>
              <button type="button" onClick={onClose} aria-label="닫기" className="flex-shrink-0 w-8 h-8 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <ul className="overflow-y-auto flex-1 p-4 space-y-2">
              {vals.map((t, i) => (<li key={i} className={LI}>{t}</li>))}
            </ul>
            <div className="px-5 py-2.5 border-t border-gray-100 text-[11px] text-gray-400 text-center">총 {vals.length}개 응답</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function TextAgg({ q, vals }) {
  const [open, setOpen] = useState(false)
  if (!vals.length) return <p className="text-[13px] text-gray-400">응답 없음</p>
  const LIMIT = 5
  return (
    <>
      <ul className="space-y-2">
        {vals.slice(0, LIMIT).map((t, i) => (<li key={i} className={LI}>{t}</li>))}
      </ul>
      {vals.length > LIMIT && (
        <button type="button" onClick={() => setOpen(true)}
          className="w-full mt-2 h-9 rounded-lg bg-gray-50 text-gray-500 text-[13px] font-semibold hover:bg-gray-100 transition">
          전체 보기 ({vals.length}개)
        </button>
      )}
      <ResponsesModal open={open} title={q.q} vals={vals} onClose={() => setOpen(false)} />
    </>
  )
}

export default function SurveyResults({ questions = [], responses = [] }) {
  return (
    <div className="space-y-3">
      {questions.map((q, i) => {
        const vals = responses.map((r) => r?.answers?.[q.id]).filter((v) => v != null && v !== '')
        return (
          <Reveal key={q.id} index={i} className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft">
            <p className="text-[14px] font-bold text-gray-800 mb-1 break-keep">{q.q}</p>
            <p className="text-[11px] text-gray-400 mb-3">{vals.length}명 응답</p>
            {q.type === 'scale' ? <ScaleAgg q={q} vals={vals} /> : <TextAgg q={q} vals={vals} />}
          </Reveal>
        )
      })}
    </div>
  )
}
