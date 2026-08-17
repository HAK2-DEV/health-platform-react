import { useState } from 'react'
import SurveySheet from '../../components/program/SurveySheet'
import { defaultSurvey } from '../../lib/surveyDefaults'

// 🔧 시작 설문 노출 방식 비교 데모 — A(1회 시트) vs B(얇은 칩 3종). 라우트: /dev/survey-ui
const Q = defaultSurvey({ categories: ['WALKING'] })

// 개요 맥락 목업 (히어로 + 진행현황 카드) — 그 사이에 노출 방식을 끼워 비교
function MockOverview({ slot }) {
  return (
    <div className="space-y-2.5">
      <div className="relative h-24 rounded-2xl overflow-hidden flex items-end p-3.5" style={{ background: 'linear-gradient(115deg,#3ec48b,#0c9082)' }}>
        <div className="text-white">
          <p className="text-[10px] opacity-80">D+2 · 4주 여정</p>
          <p className="text-[15px] font-extrabold leading-tight">우리 동네 걷기 챌린지</p>
        </div>
      </div>
      {slot}
      <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft">
        <p className="text-[13px] font-bold text-gray-800 mb-2">오늘의 진행 현황</p>
        <div className="h-14 rounded-xl bg-gray-50" />
      </div>
    </div>
  )
}

function Label({ children, note }) {
  return (
    <div className="mt-6 mb-2">
      <p className="text-[13px] font-extrabold text-gray-800">{children}</p>
      {note && <p className="text-[11px] text-gray-400 mt-0.5">{note}</p>}
    </div>
  )
}

export default function SurveyUiDemo() {
  const [sheetOpen, setSheetOpen] = useState(false)

  // ── 노출 변형들 ──
  const currentBanner = (
    <div className="flex items-center gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
      <span className="text-xl flex-shrink-0">📋</span>
      <p className="flex-1 min-w-0 text-xs text-emerald-800 leading-snug"><span className="font-bold">시작 설문에 답해주세요.</span> 나중에 내 변화를 확인할 수 있어요.</p>
      <button type="button" className="flex-shrink-0 px-3 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-xs font-semibold rounded-full">답하기</button>
      <button type="button" className="flex-shrink-0 text-[11px] text-emerald-700/70 px-1">나중에</button>
    </div>
  )

  const chipLine = (
    <button type="button" onClick={() => setSheetOpen(true)}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/70 text-emerald-700 text-[12px] font-medium">
      <span>📋</span> 시작 설문 (30초) <span className="ml-auto text-emerald-600 font-semibold">답하기 ›</span>
    </button>
  )

  const chipPill = (
    <div>
      <button type="button" onClick={() => setSheetOpen(true)}
        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold">
        📋 시작 설문
      </button>
    </div>
  )

  const chipText = (
    <div>
      <button type="button" onClick={() => setSheetOpen(true)}
        className="inline-flex items-center gap-1 text-[12px] text-emerald-600 font-medium underline underline-offset-2 decoration-emerald-300">
        📋 시작 설문 답하기
      </button>
    </div>
  )

  return (
    <div className="max-w-md mx-auto px-4 py-6" style={{ background: '#fdfbf7', minHeight: '100dvh' }}>
      <h1 className="text-lg font-extrabold text-gray-900">시작 설문 노출 방식 비교</h1>
      <p className="text-[12px] text-gray-400 mb-2">A(1회 시트) vs B(얇은 칩) · /dev/survey-ui</p>

      <Label note="답할 때까지 매번 뜸 · 개요 클러터 걱정된 그 버전">지금(참고): 풀-폭 배너</Label>
      <MockOverview slot={currentBanner} />

      <Label note="첫 진입 시 시트가 1회 자동으로 뜸 · 개요엔 아무 것도 안 둠">🅰 첫 진입 1회 시트</Label>
      <MockOverview slot={null} />
      <button type="button" onClick={() => setSheetOpen(true)}
        className="mt-2 w-full h-11 rounded-xl bg-emerald-500 text-white text-[14px] font-bold">▶ 첫 진입 시트 미리보기</button>

      <Label note="한 줄 · 얇게 · 안 막음 (탭하면 시트)">🅱-1 얇은 한 줄 칩</Label>
      <MockOverview slot={chipLine} />

      <Label note="아주 작은 알약 칩 · 좌측 정렬 (탭하면 시트)">🅱-2 작은 알약 칩</Label>
      <MockOverview slot={chipPill} />

      <Label note="거의 텍스트 링크 수준 · 최소 (탭하면 시트)">🅱-3 텍스트 링크 칩</Label>
      <MockOverview slot={chipText} />

      <SurveySheet open={sheetOpen} title="시작 설문" questions={Q} initial={null}
        onClose={() => setSheetOpen(false)} onSubmit={() => setSheetOpen(false)} />
    </div>
  )
}
