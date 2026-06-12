// 공용 Badge — Day 65 Phase 0.2.
// 프로그램 상태 / 추천 / 완료 등 시각 뱃지 통일.
//
// 참고 사진 패턴: pill 형태 + 톤별 배경+텍스트 색상.
//
// variants:
//   progress:  진행중 (연한 그린 배경 + 진한 그린 텍스트)
//   draft:     임시저장 (연한 회색 배경 + 회색 텍스트)
//   upcoming:  참여예정 (연한 sky 배경 + sky 텍스트)
//   ended:     종료 (회색 — 더 이상 진행 X 의미)
//   recommend: 추천 (그린 배경 + 흰 텍스트, 강조)
//   point:     포인트 (+10P 같은 라벨, mint 배경 + 진한 그린)
//   info:      안내 (sky)
//   warning:   경고 (amber)
//
// props:
//   variant:  위 키 중 하나
//   size:     'sm'·'md' (text-xs, 패딩만 차이) | 'lg' (text-sm)
//   icon:     선택 아이콘 (왼쪽)

const VARIANT = {
  progress: 'bg-emerald-100 text-emerald-700',
  draft: 'bg-gray-100 text-gray-500',
  upcoming: 'bg-sky-100 text-sky-700',
  ended: 'bg-gray-200 text-gray-600',
  recommend: 'bg-emerald-500 text-white shadow-sm',
  point: 'bg-emerald-50 text-emerald-700 font-semibold',
  info: 'bg-sky-50 text-sky-700',
  warning: 'bg-amber-50 text-amber-700',
}

const SIZE = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5',
  lg: 'text-sm px-2.5 py-1',
}

function Badge({ variant = 'progress', size = 'md', icon, children, className = '' }) {
  const variantCls = VARIANT[variant] || VARIANT.progress
  const sizeCls = SIZE[size] || SIZE.md
  return (
    <span className={`inline-flex items-center gap-1 rounded-pill ${variantCls} ${sizeCls} ${className}`}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  )
}

export default Badge
