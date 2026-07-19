import { useState, useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import { ProgramSlideCard } from './DashboardPage'

// 운영자 「오늘의 운영 현황」 데모 — /operator-summary-demo.
//   · 운영 프로그램 캐러셀(최대 2개 제한) → 슬라이드로 대표/2번째 전환 시 아래 숫자도 바뀜
//   · 타일: 인증 심사 / 참여 승인 / 신고 처리 / (4번째: 오늘 참여율 vs 오늘 인증 수 — 2버전 비교)
//   · 앞 3개는 「할 일(인박스)」 — 값>0 이면 강조. 4번째는 활발도 pulse.

// 운영 프로그램 2개 + 각자의 오늘 운영 통계(목업)
const PROGRAMS = [
  {
    p: { id: 'a', name: '삶이되는 웨이트', start_date: '2026-06-01', end_date: '2026-08-25', categories: ['EXERCISE'], cover_image_path: null },
    participants: 8,
    op: { review: 5, join: 2, report: 1, todayVerifs: 12, todayRate: 68 },
  },
  {
    p: { id: 'b', name: '외부강사 2', start_date: '2026-07-12', end_date: '2026-07-26', categories: ['MINDCARE'], cover_image_path: null },
    participants: 1,
    op: { review: 0, join: 1, report: 0, todayVerifs: 3, todayRate: 40 },
  },
]

// 운영자 타일 — 앞 3개(인박스, 값>0 강조) + 오늘 참여율(pulse). 아이콘: 본인 제공(operator/*).
const TILES = [
  { key: 'review', label: '인증 심사', img: '/icons/operator/review.png', bg: 'bg-emerald-50', accent: 'text-emerald-600', unit: '개', inbox: true },
  { key: 'join', label: '참여 승인', img: '/icons/operator/approve.png', bg: 'bg-sky-50', accent: 'text-sky-600', unit: '개', inbox: true },
  { key: 'report', label: '신고 처리', img: '/icons/operator/report.png', bg: 'bg-amber-50', accent: 'text-amber-500', unit: '개', inbox: true },
  { key: 'todayRate', label: '오늘 참여율', img: '/icons/operator/rate.png', bg: 'bg-violet-50', unit: '%', inbox: false },
]

function Tile({ m, value }) {
  const on = m.inbox && value > 0
  return (
    <div className={`rounded-2xl p-3 flex flex-col items-center text-center ${m.bg} shadow-soft`}>
      <img src={m.img} alt="" aria-hidden="true" className="w-10 h-10 object-contain" />
      <p className="text-[11.5px] text-gray-500 mt-2 break-keep leading-tight">{m.label}</p>
      <p className="text-[18px] font-extrabold leading-tight mt-0.5">
        <span className={on ? m.accent : 'text-gray-900'}>{value}</span>
        <span className="text-[11px] text-gray-500 font-bold ml-0.5">{m.unit}</span>
      </p>
    </div>
  )
}

function TileRow({ op }) {
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {TILES.map(m => <Tile key={m.key} m={m} value={op[m.key]} />)}
    </div>
  )
}

function OperatorSummaryDemoPage() {
  const trackRef = useRef(null)
  const [slide, setSlide] = useState(0)
  const onTrackScroll = (e) => {
    const el = e.currentTarget
    const first = el.firstElementChild
    if (!first) return
    const step = first.offsetWidth + 12
    setSlide(Math.max(0, Math.min(PROGRAMS.length - 1, Math.round(el.scrollLeft / step))))
  }
  const sel = PROGRAMS[slide]

  return (
    <div className="min-h-screen bg-gray-50 py-4">
      <div className="max-w-[460px] mx-auto px-4">
        <h1 className="text-lg font-bold text-gray-900 mb-1">운영자 「오늘의 운영 현황」 데모</h1>
        <p className="text-[12px] text-gray-500 mb-4">카드를 좌우로 슬라이드하면 아래 숫자가 그 프로그램 기준으로 바뀝니다. (현재: <b>{sel.p.name}</b>)</p>

        {/* 프로그램 캐러셀 (운영중) */}
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-bold text-gray-800">프로그램</h2>
          <span className="inline-flex items-center gap-0.5 bg-gray-100 rounded-full p-0.5">
            <span className="px-2.5 py-1 rounded-full text-[12px] font-bold bg-white text-emerald-600 shadow-sm">운영중</span>
            <span className="px-2.5 py-1 rounded-full text-[12px] font-bold text-gray-500">참여중</span>
          </span>
        </div>
        <div className="overflow-hidden">
          <div ref={trackRef} onScroll={onTrackScroll} className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-0.5 pb-1">
            {PROGRAMS.map((x, i) => (
              <div key={x.p.id} className="snap-start flex-shrink-0 w-[86%]">
                <ProgramSlideCard program={x.p} participants={x.participants} active={i === slide} onClick={() => {}} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-center items-center gap-1.5 mt-2.5 mb-6">
          {PROGRAMS.map((x, i) => (
            <span key={x.p.id} className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-4 bg-emerald-500' : 'w-1.5 bg-gray-300'}`} />
          ))}
        </div>

        {/* 제목 (운영중 버전) */}
        <h2 className="text-base font-bold text-gray-800 mb-3">오늘의 운영 현황</h2>
        <TileRow op={sel.op} />

        <div className="mt-8 rounded-xl bg-white border border-gray-100 p-4 text-[12px] text-gray-500 leading-relaxed">
          <p className="font-bold text-gray-700 mb-1">메모</p>
          · 앞 3개(심사·승인·신고)는 <b>할 일 인박스</b> — 값&gt;0 이면 색으로 강조, 탭하면 그 프로그램의 처리 화면으로.<br />
          · <b>인증 심사</b> 탭 → 오늘 인증 수 통계도 함께 보여줘 참여율·인증수 둘 다 커버.<br />
          · 슬라이드로 2번째 운영 프로그램 선택 시 숫자 전환(실배선 시 각 프로그램 집계).
        </div>
      </div>
    </div>
  )
}

export default OperatorSummaryDemoPage
