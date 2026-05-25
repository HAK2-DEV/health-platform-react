import { ChevronLeft } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

// 스크롤을 내려도 상단에 따라오는 뒤로가기 바
// 부모 페이지가 px-4 max-w-4xl 패턴인 경우 -mx-4 로 그 padding 을 뚫고
// 양쪽까지 sticky 영역 확장. 반투명 배경 + backdrop-blur 로 콘텐츠 위에 자연스럽게 떠 보임.
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
    <div className="sticky top-0 z-30 -mx-4 mb-2 px-4 py-2 bg-white/80 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleClick}
          className="flex items-center justify-center w-9 h-9 -ml-1 rounded-full hover:bg-gray-100 transition flex-shrink-0"
          title={title || '뒤로'}
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </div>
  )
}

export default StickyBackBar
