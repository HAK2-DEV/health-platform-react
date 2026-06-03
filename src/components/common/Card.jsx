// 공용 Card 프리미티브 — Day 65 Phase 0.2.
// 참고 사진의 카드 양식 통일: 24px 라운드, 부드러운 그림자, 카테고리 틴팅 옵션.
//
// props:
//   tint:        'plain' (흰색) | 'mint' (운동/건강) | 'peach' (마음관리) | 'cream' (랭킹)
//   interactive: true 면 cursor + hover/active 효과
//   padding:     'sm' | 'md' | 'lg' | 'none'  (기본 md)
//   as:          'div' (기본) | 'button' | 'a' 등 — 클릭 영역 의미
//   className:   추가 클래스 (마진/그리드 등)
//
// 사용 예:
//   <Card tint="mint" interactive onClick={...}>...</Card>
//   <Card as="button" interactive padding="lg" onClick={...}>...</Card>

const TINT_BG = {
  plain: 'bg-surface-card border border-gray-100',
  mint: 'bg-surface-mint border border-emerald-100',
  peach: 'bg-surface-peach border border-orange-100',
  cream: 'bg-surface-cream border border-amber-100',
}

const PAD = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
}

function Card({
  tint = 'plain',
  interactive = false,
  padding = 'md',
  as: Component = 'div',
  className = '',
  children,
  ...rest
}) {
  const tintCls = TINT_BG[tint] || TINT_BG.plain
  const padCls = PAD[padding] ?? PAD.md
  const interactiveCls = interactive
    ? 'cursor-pointer transition hover:shadow-elevated active:scale-[0.99]'
    : ''
  return (
    <Component
      className={`${tintCls} rounded-card shadow-soft ${padCls} ${interactiveCls} ${className}`}
      {...rest}
    >
      {children}
    </Component>
  )
}

export default Card
