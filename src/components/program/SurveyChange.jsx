// 운영자 — 시작 vs 종료 설문 변화 뷰(척도 문항 평균 델타). 척도는 "높을수록 건강".
const avgOf = (responses, qid) => {
  const vals = responses.map((r) => r?.answers?.[qid]).filter((v) => typeof v === 'number')
  if (!vals.length) return { avg: null, n: 0 }
  return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length }
}

function Bar({ label, val, pct, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-[11px] text-gray-400 flex-shrink-0">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-[12px] font-semibold text-gray-700 tabular-nums flex-shrink-0">
        {val == null ? '–' : val.toFixed(1)}
      </span>
    </div>
  )
}

export default function SurveyChange({ startQuestions = [], endQuestions = [], startResponses = [], endResponses = [] }) {
  // 시작·종료 문항이 각자 편집되므로, 같은 id의 척도 문항만 변화 비교(둘 다 존재)
  const endById = new Map(endQuestions.map((q) => [q.id, q]))
  const scaleQs = startQuestions.filter((q) => q.type === 'scale' && endById.get(q.id)?.type === 'scale')
  const textQs = startQuestions.filter((q) => q.type !== 'scale')

  return (
    <div className="space-y-3">
      {scaleQs.map((q) => {
        const min = q.min ?? 1, max = q.max ?? 5
        const s = avgOf(startResponses, q.id)
        const e = avgOf(endResponses, q.id)
        const pct = (v) => (v == null ? 0 : ((v - min) / (max - min)) * 100)
        const delta = (s.avg != null && e.avg != null) ? e.avg - s.avg : null
        const up = delta != null && delta > 0.05
        const down = delta != null && delta < -0.05
        return (
          <div key={q.id} className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft">
            <div className="flex items-start gap-2 mb-3">
              <p className="flex-1 text-[13px] font-semibold text-gray-800 break-keep leading-snug">{q.q}</p>
              {delta != null && (
                <span className={`flex-shrink-0 inline-flex items-center gap-0.5 h-6 px-2 rounded-full text-[12px] font-bold tabular-nums ${up ? 'bg-emerald-50 text-emerald-600' : down ? 'bg-rose-50 text-rose-500' : 'bg-gray-100 text-gray-400'}`}>
                  {up ? '▲' : down ? '▼' : '–'} {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              <Bar label="시작" val={s.avg} pct={pct(s.avg)} color="bg-gray-300" />
              <Bar label="종료" val={e.avg} pct={pct(e.avg)} color="bg-emerald-500" />
            </div>
            <p className="mt-2 text-[11px] text-gray-400">
              {min}~{max}점 · 높을수록 좋음 · 시작 {s.n}명 → 종료 {e.n}명
            </p>
          </div>
        )
      })}

      {textQs.length > 0 && (
        <p className="text-[12px] text-gray-400 px-1 break-keep leading-snug">
          단답 문항({textQs.map((q) => q.q).join(' · ')})은 「시작」·「종료」 탭에서 개별 응답을 볼 수 있어요.
        </p>
      )}

      {scaleQs.length === 0 && (
        <p className="text-[13px] text-gray-500 text-center py-6">척도 문항이 없어 비교할 변화 지표가 없어요.</p>
      )}
    </div>
  )
}
