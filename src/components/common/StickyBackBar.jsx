import { ChevronLeft } from 'lucide-react'

// 스크롤을 내려도 상단에 따라오는 뒤로가기 바
// 부모 페이지가 px-4 max-w-4xl 패턴인 경우 -mx-4 로 그 padding 을 뚫고
// 양쪽까지 sticky 영역 확장. 반투명 배경 + backdrop-blur 로 콘텐츠 위에 자연스럽게 떠 보임.
function StickyBackBar({ onClick, title }) {
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-2 px-4 py-2 bg-white/80 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClick}
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
