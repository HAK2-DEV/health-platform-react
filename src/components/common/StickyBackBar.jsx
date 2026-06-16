import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

// 스크롤을 내려도 상단에 따라오는 뒤로가기 바
// Day 65 본인 결정: 흰 배경 박스 제거 — 뒤로가기 아이콘만 자연스럽게 떠 있도록 transparent.
// 아이콘 자체는 원형 ring 으로 가독성 확보 (콘텐츠 위 겹침 대비).
//
// 동작:
//   - 기본: navigate(-1) — history 를 자연스럽게 한 칸 pop (루프 방지)
//   - location.key === 'default' (deep link / 첫 진입) 인 경우 fallbackPath 로 replace 이동
//   - onClick 을 명시하면 그 콜백을 우선 사용 (레거시 호환)
//
// props:
//   onClick:    명시적 핸들러 (선택)
//   fallbackPath: deep link 시 이동 경로
//   title:      버튼 tooltip
//   breadcrumb: string[] — 뒤로가기 옆에 「A > B > C」 형태로 표시 (선택)
//                마지막 항목이 현재 페이지 — 진하게, 나머지는 회색
function StickyBackBar({ onClick, fallbackPath, title, breadcrumb, rightSlot }) {
  const navigate = useNavigate()
  const location = useLocation()

  const smartBack = () => {
    if (location.key === 'default' && fallbackPath) {
      navigate(fallbackPath, { replace: true })
    } else {
      navigate(-1)
    }
  }

  const handleClick = onClick || smartBack
  const hasBreadcrumb = Array.isArray(breadcrumb) && breadcrumb.length > 0

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-1 px-4 py-1 pointer-events-none">
      <div className="flex items-center gap-2">
      <div className={`flex items-center gap-2 min-w-0 pointer-events-auto ${hasBreadcrumb ? 'bg-white/85 backdrop-blur-sm rounded-full pr-3 shadow-sm' : ''}`}>
        <button
          type="button"
          onClick={handleClick}
          className={`flex items-center justify-center w-9 h-9 -ml-1 rounded-full transition flex-shrink-0 ${
            hasBreadcrumb
              ? 'hover:bg-white/80'
              : 'bg-white/70 backdrop-blur-sm shadow-sm hover:bg-white'
          }`}
          title={title || '뒤로'}
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>

        {hasBreadcrumb && (
          <nav aria-label="breadcrumb" className="flex items-center min-w-0 text-sm">
            {breadcrumb.map((label, idx) => {
              const isLast = idx === breadcrumb.length - 1
              // 첫 항목 (프로그램명 등) 만 truncate — 짧은 「통계」/「미션별」 은 항상 보이도록.
              // 첫 항목이 min-w-0 flex 안에서 줄어들며 우측 항목 공간을 확보.
              const isFirst = idx === 0
              return (
                <span key={idx} className={`flex items-center ${isFirst ? 'min-w-0' : 'flex-shrink-0'}`}>
                  {idx > 0 && (
                    <ChevronRight className="w-3 h-3 text-gray-300 mx-1 flex-shrink-0" />
                  )}
                  <span
                    className={`${isFirst ? 'truncate' : ''} ${
                      isLast
                        ? 'text-gray-800 font-semibold'
                        : 'text-gray-500'
                    }`}
                  >
                    {label}
                  </span>
                </span>
              )
            })}
          </nav>
        )}
      </div>
      {rightSlot && <div className="ml-auto pointer-events-auto">{rightSlot}</div>}
      </div>
    </div>
  )
}

export default StickyBackBar
