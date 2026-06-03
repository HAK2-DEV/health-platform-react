import { ChevronLeft } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

// 스크롤을 내려도 상단에 따라오는 뒤로가기 바
// Day 65 본인 결정: 흰 배경 박스 제거 — 뒤로가기 아이콘만 자연스럽게 떠 있도록 transparent.
// 아이콘 자체는 원형 ring 으로 가독성 확보 (콘텐츠 위 겹침 대비).
//
// 동작:
//   - 기본: navigate(-1) — history 를 자연스럽게 한 칸 pop (루프 방지)
//   - location.key === 'default' (deep link / 첫 진입) 인 경우 fallbackPath 로 replace 이동
//   - onClick 을 명시하면 그 콜백을 우선 사용 (레거시 호환)
function StickyBackBar({ onClick, fallbackPath, title }) {
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

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-1 px-4 py-1 pointer-events-none">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleClick}
          className="pointer-events-auto flex items-center justify-center w-9 h-9 -ml-1 rounded-full bg-white/70 backdrop-blur-sm shadow-sm hover:bg-white transition flex-shrink-0"
          title={title || '뒤로'}
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
      </div>
    </div>
  )
}

export default StickyBackBar
