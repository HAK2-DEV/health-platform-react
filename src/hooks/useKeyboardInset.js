import { useState, useEffect } from 'react'

// 키보드가 뜬 높이(px)를 반환. 하단 고정 바/오버레이를 그만큼 위로 띄우는 데 사용.
//   visualViewport 로 감지 (키보드가 뜨면 뷰포트가 줄어드는 만큼).
//   네이티브 앱은 index.html 의 viewport meta `interactive-widget=resizes-content` 로
//   키보드 시 콘텐츠 뷰포트가 줄어들게 하여 이 값이 잡히도록 함. (2026-08-12)
export function useKeyboardInset() {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return inset
}
