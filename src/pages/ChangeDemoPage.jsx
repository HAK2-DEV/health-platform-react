import { ChevronLeft, Bell } from 'lucide-react'
import { ChangeCharts } from '../components/program/ProgramChangeTab'
import { formatKstDate } from '../lib/queries'

// 금연 「내 변화」(참가자) 데모 — /change-demo.
//   프로그램 개월수(1/3/6개월) 기준 화면을 한 페이지에 나란히 — 기간 적응형 확인용.
//   1개월=일별 막대·점 / 3·6개월=주별 집계(버킷).
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// 결정적 난수(스크린샷 안정) — mulberry32
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
// 가중치 맵({hour: weight})에서 시(hour) 하나 뽑기
function pickHour(weights, rnd) {
  const entries = Object.entries(weights)
  const sum = entries.reduce((a, [, w]) => a + w, 0)
  let r = rnd() * sum
  for (const [h, w] of entries) { r -= w; if (r <= 0) return Number(h) }
  return Number(entries[entries.length - 1][0])
}
const SMOKE_W = { 7: 1, 8: 2, 9: 1, 12: 2, 13: 2, 15: 1, 18: 2, 19: 3, 20: 3, 21: 2, 22: 1 }
const CRAVE_W = { 8: 2, 9: 2, 10: 1, 11: 1, 13: 3, 14: 2, 15: 2, 16: 1, 18: 2, 19: 3, 20: 3, 21: 3, 22: 2 }
const FACTORS = [
  '식사 후 커피 마실 때 확 올라왔다',
  '업무 스트레스가 몰릴 때 손이 갔다',
  '술자리에서 옆 사람이 피우니 힘들었다',
  '지루하고 습관처럼 생각났다',
  '자기 전에 늘 하던 대로 떠올랐다',
  '점심 먹고 나른할 때 당겼다',
  '동료가 나가자고 할 때 흔들렸다',
]

function buildSample(periodDays) {
  const today = new Date()
  const dayBack = (i) => { const d = new Date(today); d.setDate(d.getDate() - i); return d }
  const N = periodDays
  const rnd = mulberry32(1234 + N)

  const moods = []
  const smokingTrend = []
  const smokeHourHist = new Array(24).fill(0)
  const cravingHourHist = new Array(24).fill(0)
  const cravingNotes = []
  let smokeTotal = 0, cravingTotal = 0

  for (let idx = 0; idx < N; idx++) {          // idx: 오래된→최신
    const back = N - 1 - idx
    const dayD = dayBack(back)
    const date = formatKstDate(dayD)
    // 기분: 2.3 → 4.5 개선 + 잔물결. 6일마다 미기록.
    if (idx % 6 !== 5) {
      const base = 2.3 + (idx / Math.max(1, N - 1)) * 2.2
      const wiggle = ((idx % 3) - 1) * 0.7
      moods.push({ logged_date: date, mood: clamp(Math.round(base + wiggle), 1, 5) })
    }
    // 흡연: 초반 감소 → 후반 거의 0. 개비마다 시각 배정(히스토그램=총합 일치).
    let cig = 0
    if (idx < N * 0.1) cig = 2 + (idx % 2)
    else if (idx < N * 0.3) cig = idx % 3 === 0 ? 1 : 0
    else if (idx < N * 0.6) cig = idx % 9 === 0 ? 1 : 0
    else cig = idx % 17 === 0 ? 1 : 0
    smokeTotal += cig
    smokingTrend.push({ date, cigarettes: cig })
    for (let c = 0; c < cig; c++) smokeHourHist[pickHour(SMOKE_W, rnd)] += 1
    // 욕구: 초반 많고 후반 적음. 각 욕구에 시각 + 45% 확률로 요인 메모.
    let cr = idx < N * 0.3 ? 2 + Math.floor(rnd() * 2) : idx < N * 0.6 ? 1 + Math.floor(rnd() * 1.5) : (rnd() < 0.4 ? 1 : 0)
    for (let k = 0; k < cr; k++) {
      const h = pickHour(CRAVE_W, rnd)
      cravingHourHist[h] += 1; cravingTotal += 1
      if (rnd() < 0.45) {
        const at = new Date(dayD); at.setHours(h, 20, 0, 0)
        cravingNotes.push({ text: FACTORS[Math.floor(rnd() * FACTORS.length)], at: at.toISOString() })
      }
    }
  }
  cravingNotes.sort((a, b) => new Date(b.at) - new Date(a.at))

  return { moods, stats: { smokeTotal, smokingTrend, smokeHourHist, cravingTotal, cravingHourHist, cravingNotes: cravingNotes.slice(0, 60) } }
}

const PERIODS = [
  { label: '1개월', sub: '일별', days: 30 },
  { label: '3개월', sub: '주별 집계', days: 90 },
  { label: '6개월', sub: '주별 집계', days: 180 },
]

function ChangeScreen({ label, sub, days }) {
  const { moods, stats } = buildSample(days)
  return (
    <div className="mb-8">
      {/* 기준 라벨 */}
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <span className="inline-flex items-center px-2.5 h-6 rounded-full bg-emerald-500 text-white text-[12px] font-bold">{label} 기준</span>
        <span className="text-[11px] text-gray-400">{sub}</span>
      </div>
      {/* 서브화면 헤더(뒤로 + 제목) — 카드홈 서브화면 모사 */}
      <div className="h-[44px] flex items-center justify-center relative mb-2 bg-white rounded-t-2xl border-b border-gray-100">
        <ChevronLeft className="absolute left-3 w-5 h-5 text-gray-600" />
        <span className="text-[15px] font-bold text-gray-800">내 변화</span>
        <div className="absolute right-3 flex items-center gap-1.5">
          <Bell className="w-[18px] h-[18px] text-gray-600" />
          <div className="w-7 h-7 rounded-full bg-gray-200" />
        </div>
      </div>
      <ChangeCharts moods={moods} stats={stats} periodDays={days} />
    </div>
  )
}

export default function ChangeDemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-4">
      <div className="max-w-[430px] mx-auto px-[11px]">
        <h1 className="text-lg font-extrabold text-gray-900 mb-4 px-0.5">「내 변화」 기간별 데모</h1>
        {PERIODS.map(p => <ChangeScreen key={p.days} label={p.label} sub={p.sub} days={p.days} />)}
      </div>
    </div>
  )
}
