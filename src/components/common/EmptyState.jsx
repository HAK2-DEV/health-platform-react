// 공통 빈 상태 컴포넌트 — 페이지/섹션의 데이터 0 일 때 부드러운 안내
//
// props:
//   icon:        이모지 1자 (예: '📭', '🏆', '📷')
//   title:       굵은 한 줄 (예: '아직 알림이 없어요')
//   description: 보조 한 줄 (옵션)
//   action:      { label: string, onClick?: fn, to?: string } — 옵션, 표시 시 CTA 칩
//   variant:     'soft' (기본, 옅은 회색) | 'mint' (emerald tint) — 페이지 톤 맞춤
//   size:        'sm' (간단 줄임용) | 'md' (기본) | 'lg' (페이지 전체 빈 상태)
//
// 사용:
//   <EmptyState icon="📭" title="아직 알림이 없어요" />
//   <EmptyState icon="🏆" title="참여 중인 프로그램이 없어요" description="둘러보기에서 시작해보세요"
//     action={{ label: '프로그램 둘러보기', onClick: ... }} size="lg" variant="mint" />

import { Link } from 'react-router-dom'

const VARIANT_BG = {
  soft: 'bg-gray-50/60',
  mint: 'bg-emerald-50/50',
}
const SIZE_PAD = {
  sm: 'p-6',
  md: 'p-8',
  lg: 'p-10',
}
const SIZE_ICON = {
  sm: 'text-3xl mb-1',
  md: 'text-4xl mb-2',
  lg: 'text-5xl mb-3',
}
const SIZE_TITLE = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-base',
}

function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'soft',
  size = 'md',
  className = '',
}) {
  return (
    <div
      className={`
        ${VARIANT_BG[variant] || VARIANT_BG.soft}
        ${SIZE_PAD[size] || SIZE_PAD.md}
        rounded-2xl text-center
        ${className}
      `}
    >
      {icon && (
        <div className={`${SIZE_ICON[size] || SIZE_ICON.md} opacity-70 leading-none`}>
          {icon}
        </div>
      )}
      {title && (
        <p className={`${SIZE_TITLE[size] || SIZE_TITLE.md} font-medium text-gray-800 mb-1`}>
          {title}
        </p>
      )}
      {description && (
        <p className="text-xs text-gray-500">
          {description}
        </p>
      )}
      {action && (
        action.to ? (
          <Link
            to={action.to}
            className="inline-flex items-center gap-1 mt-4 px-5 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm font-medium rounded-full transition shadow-sm"
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-1 mt-4 px-5 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm font-medium rounded-full transition shadow-sm"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  )
}

export default EmptyState
