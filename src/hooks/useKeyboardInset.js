import { useState, useEffect } from 'react'

// iOS 키보드가 뜨면 visualViewport 가 줄어드는 만큼(키보드 높이 px)을 반환한다.
//   공용 Modal 은 자체 내장(visualViewport 패딩) — 이 훅은 **공용 Modal 을 안 쓰는 커스텀 오버레이/
//   고정 바**용. 사용:
//     - 하단 고정 바:      <div className="fixed bottom-0 ..." style={{ bottom: kb }}>
//     - 중앙/하단 오버레이: <div className="fixed inset-0 flex items-center ..." style={{ paddingBottom: kb }}>
//   → 입력·버튼이 키보드에 가려지지 않게 위로 올라온다. (참고 원형: CheerModal)
export function useKeyboardInset() {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update) }
  }, [])
  return inset
}
