// 공용 IconBox — Day 65 Phase 0.2.
// 통계 카드 / 메뉴 카드 / 미션 카드의 원형 컬러 아이콘 박스 통일.
//
// 참고 사진 패턴: 둥근 사각 배경 + 가운데 정렬 아이콘.
//   - 통계 카드: bg-emerald-100 + emerald 아이콘
//   - 메뉴 카드: 카테고리별 컬러 (알림=violet, 계정=emerald, 인증=emerald 등)
//   - 미션 카드: 큰 사이즈 + 이모지/이미지
//
// props:
//   tone:   'emerald' | 'sky' | 'amber' | 'violet' | 'orange' | 'pink' | 'indigo' | 'red' | 'slate'
//   size:   'sm' (32px) | 'md' (40px) | 'lg' (48px) | 'xl' (64px)
//   shape:  'square' (rounded-xl) | 'circle' (rounded-full)
//   className: 추가 클래스
//   children: 아이콘 컴포넌트 또는 이모지

const TONE_BG = {
  emerald: 'bg-emerald-100 text-emerald-600',
  sky: 'bg-sky-100 text-sky-600',
  amber: 'bg-amber-100 text-amber-600',
  violet: 'bg-violet-100 text-violet-600',
  orange: 'bg-orange-100 text-orange-600',
  peach: 'bg-orange-50 text-orange-500',
  pink: 'bg-pink-100 text-pink-600',
  indigo: 'bg-indigo-100 text-indigo-600',
  red: 'bg-red-100 text-red-600',
  slate: 'bg-slate-100 text-slate-600',
  mint: 'bg-emerald-50 text-emerald-500',
}

const SIZE = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-2xl',
}

const SHAPE = {
  square: 'rounded-xl',
  circle: 'rounded-full',
}

function IconBox({
  tone = 'emerald',
  size = 'md',
  shape = 'square',
  className = '',
  children,
}) {
  const toneCls = TONE_BG[tone] || TONE_BG.emerald
  const sizeCls = SIZE[size] || SIZE.md
  const shapeCls = SHAPE[shape] || SHAPE.square
  return (
    <div className={`${toneCls} ${sizeCls} ${shapeCls} flex items-center justify-center flex-shrink-0 ${className}`}>
      {children}
    </div>
  )
}

export default IconBox
