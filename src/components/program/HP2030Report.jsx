import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { hp2030Mapping, NATIONAL_BENCHMARK_ENABLED } from '../../lib/hp2030'
import { fetchNationalIndicator } from '../../lib/queries'
import { Reveal, CountUp } from './statsAnim'

// 운영자 — HP2030 성과 기여 반출뷰. 자기보고 시작→종료 변화 + 형평성(성별·연령).
//   B2G 반출 대비: 소표본(N<EXPORT_MIN_N) 그룹은 수치 숨김. 규칙기반 겸손 톤.
const EXPORT_MIN_N = 5
const AGE_LABEL = { '10s': '10대', '20s': '20대', '30s': '30대', '40s': '40대', '50s': '50대', '60s': '60대', '70s': '70대' }
const AGE_ORDER = ['10s', '20s', '30s', '40s', '50s', '60s', '70s']

const agg = (responses, qid, belongs = () => true) => {
  const vals = responses.filter((r) => belongs(r.user_id)).map((r) => r?.answers?.[qid]).filter((v) => typeof v === 'number')
  return { avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, n: vals.length }
}
const fmt = (v) => (v == null ? '–' : v.toFixed(1))
const deltaStr = (s, e) => (s == null || e == null) ? '–' : `${e - s > 0 ? '+' : ''}${(e - s).toFixed(1)}`

function DeltaTag({ s, e }) {
  if (s == null || e == null) return <span className="text-gray-400 text-[12px]">–</span>
  const d = e - s, up = d > 0.05, down = d < -0.05
  return <span className={`tabular-nums text-[12px] font-bold ${up ? 'text-emerald-600' : down ? 'text-rose-500' : 'text-gray-400'}`}>{up ? '▲' : down ? '▼' : '–'} {d > 0 ? '+' : ''}{d.toFixed(1)}</span>
}

export default function HP2030Report({ program, startQuestions = [], endQuestions = [], startResponses = [], endResponses = [], demographics = {}, partCount = 0 }) {
  const [copied, setCopied] = useState(false)
  const map = hp2030Mapping(program)
  // 전국 참고값(국립암센터) — 매핑에 지표가 있을 때만. 연 단위라 하루 캐시.
  const { data: national } = useQuery({
    queryKey: ['national-indicator', map.nationalIndicator],
    queryFn: () => fetchNationalIndicator(map.nationalIndicator),
    enabled: NATIONAL_BENCHMARK_ENABLED && !!map.nationalIndicator,
    staleTime: 1000 * 60 * 60 * 24,
  })
  const endById = new Map(endQuestions.map((q) => [q.id, q]))
  const scaleQs = startQuestions.filter((q) => q.type === 'scale' && endById.get(q.id)?.type === 'scale')
  const primaryQ = scaleQs.find((q) => q.id === map.primary) || scaleQs[0] || null

  const groups = (dim) => {
    if (dim === 'gender') return [
      { label: '남성', test: (u) => demographics[u]?.gender === 'M' },
      { label: '여성', test: (u) => demographics[u]?.gender === 'F' },
    ]
    const present = new Set(Object.values(demographics).map((x) => x.age_range).filter(Boolean))
    return AGE_ORDER.filter((a) => present.has(a)).map((a) => ({ label: AGE_LABEL[a], test: (u) => demographics[u]?.age_range === a }))
  }

  const primaryS = primaryQ ? agg(startResponses, primaryQ.id) : null
  const primaryE = primaryQ ? agg(endResponses, primaryQ.id) : null

  const buildSummary = () => {
    const L = []
    L.push('[HP2030 성과 기여 요약]')
    L.push(`프로그램: ${program.name}`)
    L.push(`기여 영역: ${map.area} · ${map.indicator}`)
    L.push(`참여(활성): ${partCount}명 · 응답 시작 ${startResponses.length}/종료 ${endResponses.length}`)
    if (primaryQ) L.push(`핵심 지표(${primaryQ.q}): ${fmt(primaryS.avg)}→${fmt(primaryE.avg)} (Δ${deltaStr(primaryS.avg, primaryE.avg)})`)
    L.push('전체 문항(시작→종료, 1~5·높을수록 좋음):')
    scaleQs.forEach((q) => { const s = agg(startResponses, q.id), e = agg(endResponses, q.id); L.push(`- ${q.q}: ${fmt(s.avg)}→${fmt(e.avg)} (Δ${deltaStr(s.avg, e.avg)})`) })
    if (primaryQ) {
      L.push(`형평성 · 핵심 지표(${EXPORT_MIN_N}명 미만 숨김):`)
      ;['gender', 'age'].forEach((d) => groups(d).forEach((g) => {
        const s = agg(startResponses, primaryQ.id, g.test), e = agg(endResponses, primaryQ.id, g.test)
        const n = Math.min(s.n, e.n)
        L.push(`- ${g.label}: ${n < EXPORT_MIN_N ? `표본 적음(${n}명)` : `${fmt(s.avg)}→${fmt(e.avg)} (Δ${deltaStr(s.avg, e.avg)})`}`)
      }))
    }
    L.push('※ 자기보고 기반 · 인과관계 아님 · 소표본(5명 미만) 억제.')
    return L.join('\n')
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(buildSummary()); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    catch { /* clipboard 미지원 무시 */ }
  }

  const equityBlock = (dim, title) => primaryQ && (
    <div>
      <p className="text-[12px] font-semibold text-gray-500 mb-1.5">{title}</p>
      <div className="rounded-xl bg-gray-50 px-3 py-1">
        {groups(dim).map((g, i) => {
          const s = agg(startResponses, primaryQ.id, g.test), e = agg(endResponses, primaryQ.id, g.test)
          const n = Math.min(s.n, e.n)
          return (
            <div key={i} className="flex items-center gap-2 text-[12px] py-1.5 border-b border-gray-100 last:border-0">
              <span className="w-12 text-gray-600 flex-shrink-0">{g.label}</span>
              {n < EXPORT_MIN_N ? <span className="ml-auto text-gray-300">표본 적음 · {n}명</span> : (<>
                <span className="tabular-nums text-gray-400">{fmt(s.avg)}</span><span className="text-gray-300">→</span>
                <span className="tabular-nums text-gray-800 font-semibold">{fmt(e.avg)}</span>
                <span className="ml-auto"><DeltaTag s={s.avg} e={e.avg} /></span>
              </>)}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* 성과 요약 카드 — 헤드라인은 누구나 이해, 국가지표(HP2030)는 은은한 배지 */}
      <Reveal index={0} className="rounded-2xl p-4 bg-gradient-to-br from-teal-50 to-emerald-50 border border-emerald-100">
        <p className="text-[11px] font-bold text-emerald-600 mb-0.5">성과 요약</p>
        <p className="text-[15px] font-extrabold text-gray-900 break-keep leading-snug">활성 참여 {partCount}명 · 시작 {startResponses.length} / 종료 {endResponses.length} 응답</p>
        <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/70 border border-emerald-100 text-[11px] text-gray-500 break-keep">
          🏛 국가 건강지표(HP2030) · {map.area} · {map.indicator} 기여
        </div>
      </Reveal>

      {/* 국가 통계 참고 — 전국 지표(있을 때만). 자기보고 척도와 단위가 달라 '참고선'으로만. */}
      {national?.series?.length > 0 && (
        <Reveal index={1} className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft">
          <p className="text-[11px] font-bold text-gray-400 mb-1">국가 통계 참고</p>
          <p className="text-[13px] font-semibold text-gray-800 mb-2.5">전국 {national.label} <span className="text-gray-400 font-normal">({national.year}년)</span></p>
          <div className="flex gap-2">
            {national.series.map((s) => (
              <div key={s.name} className="flex-1 rounded-xl bg-gray-50 px-2 py-2.5 text-center">
                <p className="text-[11px] text-gray-500 mb-0.5">{s.name}</p>
                <p className="text-[18px] font-extrabold text-gray-800 tabular-nums leading-none">{s.value}<span className="text-[11px] font-normal text-gray-400">{national.unit}</span></p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-gray-400 break-keep">출처: {national.source} · 참고용(자기보고 척도와 단위가 달라 직접 비교 아님)</p>
        </Reveal>
      )}

      {/* 핵심 지표 변화 */}
      {primaryQ && (
        <Reveal index={1} className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft">
          <p className="text-[11px] font-semibold text-gray-400 mb-1">핵심 지표</p>
          <p className="text-[13px] font-semibold text-gray-800 break-keep leading-snug mb-2">{primaryQ.q}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] tabular-nums text-gray-400">{fmt(primaryS.avg)}</span>
            <span className="text-gray-300">→</span>
            {primaryE.avg == null
              ? <span className="text-[26px] font-extrabold tabular-nums text-emerald-600">–</span>
              : <CountUp value={primaryE.avg} duration={900} className="text-[26px] font-extrabold tabular-nums text-emerald-600" format={(x) => x.toFixed(1)} />}
            <span className="ml-auto"><DeltaTag s={primaryS.avg} e={primaryE.avg} /></span>
          </div>
        </Reveal>
      )}

      {/* 전체 문항 변화 */}
      <Reveal index={2} className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft">
        <p className="text-[12px] font-semibold text-gray-500 mb-2">전체 문항 (시작→종료 · 높을수록 좋음)</p>
        {scaleQs.map((q) => {
          const s = agg(startResponses, q.id), e = agg(endResponses, q.id)
          return (
            <div key={q.id} className="flex items-center gap-2 text-[12px] py-1.5 border-b border-gray-50 last:border-0">
              <span className="flex-1 text-gray-700 break-keep leading-snug">{q.q}</span>
              <span className="tabular-nums text-gray-400 flex-shrink-0">{fmt(s.avg)}→{fmt(e.avg)}</span>
              <span className="flex-shrink-0"><DeltaTag s={s.avg} e={e.avg} /></span>
            </div>
          )
        })}
      </Reveal>

      {/* 형평성 */}
      <Reveal index={3} className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft space-y-3">
        <p className="text-[13px] font-bold text-gray-800">형평성 분해 <span className="text-[11px] font-normal text-gray-400">· 핵심 지표 · {EXPORT_MIN_N}명 미만 숨김</span></p>
        {equityBlock('gender', '성별')}
        {equityBlock('age', '연령대')}
      </Reveal>

      {/* 겸손 각주 + 복사 */}
      <p className="text-[11px] text-gray-400 px-1 leading-relaxed break-keep">
        ※ 자기보고 설문 기반이며 인과관계를 뜻하지 않습니다. 개인 식별 방지를 위해 5명 미만 하위그룹은 수치를 숨깁니다.
      </p>
      <button type="button" onClick={copy}
        className="w-full h-11 rounded-xl bg-gray-900 text-white text-[14px] font-bold active:scale-[0.99] transition">
        {copied ? '복사됐어요 ✓' : '요약 텍스트 복사'}
      </button>
    </div>
  )
}
