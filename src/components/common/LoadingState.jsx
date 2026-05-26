// 공통 로딩 상태 컴포넌트 — 데이터 fetch 중 표시
//
// props:
//   text:      기본 '불러오는 중...'
//   variant:   'inline' (그냥 작은 텍스트) | 'card' (기본, 박스 안에) | 'page' (페이지 전체)
//   size:      'sm' | 'md' (기본) | 'lg'
//
// 사용:
//   <LoadingState />                              -- 카드형 기본
//   <LoadingState variant="page" />              -- 페이지 전체 중앙
//   <LoadingState variant="inline" text="가져오는 중" /> -- 인라인

function LoadingState({
  text = '불러오는 중...',
  variant = 'card',
  size = 'md',
}) {
  if (variant === 'inline') {
    return (
      <span className="text-sm text-gray-500">{text}</span>
    )
  }

  if (variant === 'page') {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center text-gray-500 text-sm">
        {text}
      </div>
    )
  }

  // card (default)
  const pad = size === 'sm' ? 'p-6' : size === 'lg' ? 'p-10' : 'p-8'
  return (
    <div className={`bg-gray-50/60 ${pad} rounded-2xl text-center text-gray-500 text-sm`}>
      {text}
    </div>
  )
}

export default LoadingState
