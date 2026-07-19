import { ProgramSlideCard } from './DashboardPage'

// 오늘의 활동 요약 파스텔 타일 미리보기(대시보드와 동일 마크업 · 목업 검증용)
const ACTIVITY = [
  { label: '미션 완료', value: 3, unit: '개', img: '/icons/activity/mission.png', bg: 'bg-[#e4fcf0]', scale: 1.25 },
  { label: '게시물 작성', value: 2, unit: '개', img: '/icons/activity/record.png', bg: 'bg-[#e7f4fe]', scale: 1.85 },
  { label: '댓글 활동', value: 5, unit: '개', img: '/icons/activity/comment.png', bg: 'bg-[#fff7dd]', scale: 1.45 },
  { label: '획득 점수', value: 120, unit: 'P', img: '/icons/activity/point.png', bg: 'bg-[#f1eeff]', scale: 0.84 },
]

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

        {/* 오늘의 활동 요약 파스텔 타일 */}
        <div className="bg-white rounded-[10px] shadow-elevated p-4 mb-6">
          <h2 className="text-base font-bold text-gray-800 mb-3">오늘의 활동 요약</h2>
          <div className="grid grid-cols-4 gap-2">
            {ACTIVITY.map(m => (
              <button key={m.label} type="button" className={`rounded-xl p-2.5 flex flex-col items-center text-center ${m.bg} transition active:scale-[0.97]`}>
                <img src={m.img} alt="" aria-hidden="true" style={{ transform: `scale(${m.scale})` }} className="w-9 h-9 object-contain" />
                <p className="text-[11px] text-gray-500 mt-1.5 break-keep leading-tight">{m.label}</p>
                <p className="text-[17px] font-extrabold text-gray-900 leading-tight mt-0.5">
                  {m.value}<span className="text-[11px] text-gray-500 font-bold ml-0.5">{m.unit}</span>
                </p>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-5">
          {CASES.map((c, i) => (
            <div key={c.p.id}>
              <p className="text-[12px] font-semibold text-gray-500 mb-1.5">{c.label} {i === 0 ? '(활성)' : '(비활성)'}</p>
              <ProgramSlideCard program={c.p} participants={c.participants} active={i === 0} onClick={() => {}} />
            </div>
          ))}
        </div>

        {/* 캐러셀 — 대시보드와 동일 조건 재현: overflow-hidden(ModeSlide) 안 + 엣지 블리드 없음.
            첫 카드(활성) 왼쪽 초록 테두리가 안 잘리는지 확인용. */}
        <p className="text-[12px] font-semibold text-gray-500 mt-6 mb-1.5">캐러셀 (활성=첫 장만 초록)</p>
        <div className="overflow-hidden">
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-0.5 pb-1">
            {CASES.map((c, i) => (
              <div key={c.p.id} className="snap-start flex-shrink-0 w-[86%]">
                <ProgramSlideCard program={c.p} participants={c.participants} active={i === 0} onClick={() => {}} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CardDemoPage
