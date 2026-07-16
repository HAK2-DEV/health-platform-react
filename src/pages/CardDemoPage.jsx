import { ProgramSlideCard } from './DashboardPage'

// 대시보드 프로그램 캐러셀 카드 UI 데모 — /card-demo. 로그인 없이 카드만 확인·디버깅용.
const CASES = [
  { label: '진행중 (표지 있음)', p: { id: '1', name: '외부강사 2', start_date: '2026-07-12', end_date: '2026-07-19', categories: ['EXERCISE'], cover_image_path: null }, participants: 1 },
  { label: '준비중 (시작 전)', p: { id: '2', name: '건강 챌린지', start_date: '2026-08-10', end_date: '2026-08-24', categories: ['DIET'], cover_image_path: null }, participants: 12 },
  { label: '종료', p: { id: '3', name: '마일스톤 test', start_date: '2026-06-05', end_date: '2026-06-30', categories: ['MINDCARE'], cover_image_path: null }, participants: 2 },
  { label: '상시 (기간 없음)', p: { id: '4', name: '상시 프로그램', start_date: null, end_date: null, categories: ['NO_SMOKING'], cover_image_path: null }, participants: 5 },
]

function CardDemoPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-[430px] mx-auto px-4">
        <h1 className="text-lg font-bold text-gray-900 mb-4">프로그램 카드 데모</h1>
        <div className="flex flex-col gap-5">
          {CASES.map(c => (
            <div key={c.p.id}>
              <p className="text-[12px] font-semibold text-gray-500 mb-1.5">{c.label}</p>
              <ProgramSlideCard program={c.p} participants={c.participants} onClick={() => {}} />
            </div>
          ))}
        </div>

        {/* 캐러셀 형태(가로 스크롤 + 다음 장 미리보기) 확인용 */}
        <p className="text-[12px] font-semibold text-gray-500 mt-6 mb-1.5">캐러셀 (86% 폭 · 스냅)</p>
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-1">
          {CASES.map(c => (
            <div key={c.p.id} className="snap-start flex-shrink-0 w-[86%]">
              <ProgramSlideCard program={c.p} participants={c.participants} onClick={() => {}} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CardDemoPage
