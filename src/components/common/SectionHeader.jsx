import { ChevronRight } from 'lucide-react'

// 공용 SectionHeader — Day 65 Phase 0.2.
// 홈/프로그램 탭의 「섹션 제목 + 전체보기 >」 반복 패턴 통일.
//
// props:
//   icon:        섹션 아이콘 (이모지 문자열 또는 <Icon /> 컴포넌트)
//   title:       섹션 제목 (필수)
//   count:       (선택) 제목 옆 작은 회색 카운트 "(2)"
//   actionLabel: (선택) 우측 액션 라벨 (기본 "전체보기")
//   onAction:    (선택) 우측 액션 클릭 핸들러 — 없으면 액션 숨김
//   actionShown: 명시적으로 액션 표시 여부 제어 (예: count <= 2 면 숨김)
//   className:   추가 클래스 (mb 등)

function SectionHeader({
  icon,
  title,
  count,
  actionLabel = '전체보기',
  onAction,
  actionShown,
  className = '',
}) {
  const showAction = actionShown ?? !!onAction

  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 min-w-0">
        {icon && (
          typeof icon === 'string'
            ? <span className="text-xl flex-shrink-0">{icon}</span>
            : <span className="flex-shrink-0">{icon}</span>
        )}
        <span className="truncate">{title}</span>
        {count != null && (
          <span className="text-sm font-medium text-gray-400 flex-shrink-0">({count})</span>
        )}
      </h2>
      {showAction && (
        <button
          type="button"
          onClick={onAction}
          className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700 flex-shrink-0"
        >
          {actionLabel}
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

export default SectionHeader
