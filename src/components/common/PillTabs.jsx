// 공용 PillTabs — Day 65 Phase 0.2.
// 알림 필터 / 랭킹 프로그램 선택 / 미션 라이브러리 카테고리 등의 칩 탭 패턴 통일.
//
// 참고 사진 패턴: pill 모양, 선택 시 진한 그린 배경 + 흰 텍스트.
// 가로 스크롤 가능 (옵션 많을 때 모바일 대응).
//
// props:
//   options: [{ value, label, icon? }]
//   value:   현재 선택된 value
//   onChange: (value) => void
//   variant: 'pill' (둥근 칩, 기본) | 'segmented' (segmented control 박스)
//   className: 추가 클래스

function PillTabs({ options, value, onChange, variant = 'pill', className = '' }) {
  if (variant === 'segmented') {
    return <SegmentedTabs options={options} value={value} onChange={onChange} className={className} />
  }

  return (
    <div
      className={`flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 ${className}`}
      style={{ scrollbarWidth: 'none' }}
    >
      {options.map(opt => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`
              flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-pill text-sm font-medium transition
              ${isActive
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-soft'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}
            `}
          >
            {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
            <span className="whitespace-nowrap">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// Segmented control — 한 통합 박스 안에 선택된 탭만 떠 보이는 스타일.
// 참고 사진의 「전체 / 최근 7일 / 최근 30일」 같은 기간 필터에 사용.
function SegmentedTabs({ options, value, onChange, className = '' }) {
  return (
    <div className={`flex gap-1 p-1 bg-gray-100 rounded-pill ${className}`}>
      {options.map(opt => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`
              flex-1 py-2 rounded-pill text-sm font-medium transition
              ${isActive
                ? 'bg-white text-brand-deep shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}
            `}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default PillTabs
