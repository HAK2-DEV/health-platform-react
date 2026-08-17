import { useState } from 'react'
import { Reveal, CountUp, useInViewOnce, STATS_EASE } from './statsAnim'

// 운영자 — 시작 vs 종료 설문 변화 뷰(척도 평균 델타). 척도는 "높을수록 건강".
//   전체 + 성별·연령 형평성 분해. 소표본(N<MIN_N) 하위그룹은 개인 식별 방지로 수치 숨김.
const MIN_N = 3
const AGE_LABEL = { '10s': '10대', '20s': '20대', '30s': '30대', '40s': '40대', '50s': '50대', '60s': '60대', '70s': '70대' }
const AGE_ORDER = ['10s', '20s', '30s', '40s', '50s', '60s', '70s']

const agg = (responses, qid, belongs = () => true) => {
  const vals = responses.filter((r) => belongs(r.user_id)).map((r) => r?.answers?.[qid]).filter((v) => typeof v === 'number')
  return { avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, n: vals.length }
}

function Bar({ label, val, pct, color }) {
  const [ref, inView] = useInViewOnce()
  return (
    <div ref={ref} className="flex items-center gap-2">
      <span className="w-8 text-[11px] text-gray-400 flex-shrink-0">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: inView ? `${pct}%` : '0%', transition: `width .6s ${STATS_EASE}` }} />
      </div>
      <span className="w-9 text-right text-[12px] font-semibold text-gray-700 tabular-nums flex-shrink-0">
        {val == null ? '–' : <CountUp value={val} duration={800} format={(x) => x.toFixed(1)} />}
      </span>
    </div>
  )
}

function DeltaBadge({ delta }) {
  if (delta == null) return null
  const up = delta > 0.05, down = delta < -0.05
  return (
    <span className={`flex-shrink-0 inline-flex items-center gap-0.5 h-6 px-2 rounded-full text-[12px] font-bold tabular-nums ${up ? 'bg-emerald-50 text-emerald-600' : down ? 'bg-rose-50 text-rose-500' : 'bg-gray-100 text-gray-400'}`}>
      {up ? '▲' : down ? '▼' : '–'} {delta > 0 ? '+' : ''}{delta.toFixed(1)}
    </span>
  )
}

// 하위그룹 한 줄 — 소표본이면 수치 숨김
function SubRow({ label, s, e, n }) {
  if (n < MIN_N) {
    return (
      <div className="flex items-center justify-between text-[12px] py-1.5 border-t border-gray-50">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-300">표본 적음 · {n}명</span>
      </div>
    )
  }
  const delta = e - s
  const up = delta > 0.05, down = delta < -0.05
  return (
    <div className="flex items-center gap-2 text-[12px] py-1.5 border-t border-gray-50">
      <span className="w-14 text-gray-600 flex-shrink-0">{label}</span>
      <span className="tabular-nums text-gray-400">{s.toFixed(1)}</span>
      <span className="text-gray-300">→</span>
      <span className="tabular-nums text-gray-800 font-semibold">{e.toFixed(1)}</span>
      <span className={`ml-auto tabular-nums font-bold ${up ? 'text-emerald-600' : down ? 'text-rose-500' : 'text-gray-400'}`}>
        {up ? '▲' : down ? '▼' : '–'} {delta > 0 ? '+' : ''}{delta.toFixed(1)}
      </span>
    </div>
  )
}

export default function SurveyChange({ startQuestions = [], endQuestions = [], startResponses = [], endResponses = [], demographics = {} }) {
  const [dim, setDim] = useState('all')  // 'all' | 'gender' | 'age'
  const endById = new Map(endQuestions.map((q) => [q.id, q]))
  const scaleQs = startQuestions.filter((q) => q.type === 'scale' && endById.get(q.id)?.type === 'scale')
  const textQs = startQuestions.filter((q) => q.type !== 'scale')

  const groupsFor = (d) => {
    if (d === 'gender') return [
      { key: 'M', label: '남성', test: (uid) => demographics[uid]?.gender === 'M' },
      { key: 'F', label: '여성', test: (uid) => demographics[uid]?.gender === 'F' },
      { key: 'none', label: '미입력', test: (uid) => !demographics[uid]?.gender },
    ]
    if (d === 'age') {
      const present = new Set(Object.values(demographics).map((x) => x.age_range).filter(Boolean))
      const gs = AGE_ORDER.filter((a) => present.has(a)).map((a) => ({ key: a, label: AGE_LABEL[a], test: (uid) => demographics[uid]?.age_range === a }))
      gs.push({ key: 'none', label: '미입력', test: (uid) => !demographics[uid]?.age_range })
      return gs
    }
    return []
  }

  return (
    <div className="space-y-3">
      {/* 전체 / 성별 / 연령 */}
      <div className="flex gap-1 p-1 rounded-xl bg-gray-100">
        {[['all', '전체'], ['gender', '성별'], ['age', '연령']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setDim(k)}
            className={`flex-1 h-8 rounded-lg text-[13px] font-semibold transition ${dim === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{l}</button>
        ))}
      </div>

      {scaleQs.map((q, idx) => {
        const min = q.min ?? 1, max = q.max ?? 5
        const s = agg(startResponses, q.id)
        const e = agg(endResponses, q.id)
        const pct = (v) => (v == null ? 0 : ((v - min) / (max - min)) * 100)
        const delta = (s.avg != null && e.avg != null) ? e.avg - s.avg : null
        return (
          <Reveal key={q.id} index={idx} className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft">
            <div className="flex items-start gap-2 mb-3">
              <p className="flex-1 text-[13px] font-semibold text-gray-800 break-keep leading-snug">{q.q}</p>
              {dim === 'all' && <DeltaBadge delta={delta} />}
            </div>

            {dim === 'all' ? (
              <>
                <div className="space-y-1.5">
                  <Bar label="시작" val={s.avg} pct={pct(s.avg)} color="bg-gray-300" />
                  <Bar label="종료" val={e.avg} pct={pct(e.avg)} color="bg-emerald-500" />
                </div>
                <p className="mt-2 text-[11px] text-gray-400">{min}~{max}점 · 높을수록 좋음 · 시작 {s.n}명 → 종료 {e.n}명</p>
              </>
            ) : (
              <div>
                {groupsFor(dim).map((g) => {
                  const gs = agg(startResponses, q.id, g.test)
                  const ge = agg(endResponses, q.id, g.test)
                  return <SubRow key={g.key} label={g.label} s={gs.avg} e={ge.avg} n={Math.min(gs.n, ge.n)} />
                })}
                <p className="mt-2 text-[11px] text-gray-400">시작→종료 평균 · {MIN_N}명 미만 그룹은 숨김</p>
              </div>
            )}
          </Reveal>
        )
      })}

      {textQs.length > 0 && (
        <p className="text-[12px] text-gray-400 px-1 break-keep leading-snug">
          단답 문항({textQs.map((q) => q.q).join(' · ')})은 「시작」·「종료」 탭에서 개별 응답을 볼 수 있어요.
        </p>
      )}

      {scaleQs.length === 0 && (
        <p className="text-[13px] text-gray-500 text-center py-6">공통 척도 문항이 없어 비교할 변화 지표가 없어요.</p>
      )}
    </div>
  )
}
