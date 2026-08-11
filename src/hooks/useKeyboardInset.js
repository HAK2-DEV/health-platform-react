import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

// 키보드가 뜬 높이(px)를 반환. 하단 고정 바/오버레이를 그만큼 위로 띄우는 데 사용.
//   사용:
//     - 하단 고정 바:      <div className="fixed bottom-0 ..." style={{ bottom: kb }}>
//     - 중앙/하단 오버레이: <div className="fixed inset-0 flex items-center ..." style={{ paddingBottom: kb }}>
//
//   높이 감지 (2026-08-11 갱신):
//     - 네이티브 앱: @capacitor/keyboard 의 keyboardWillShow 이벤트가 keyboardHeight 를 직접 제공.
//       windowSoftInputMode=adjustNothing(뷰포트 안 줄어듦)에서도 정확. 리사이즈를 건드리지 않아
//       웹뷰 붕괴 버그 회피.
//     - 웹(PWA/브라우저): visualViewport 로 폴백 (키보드 뜨면 뷰포트가 줄어드는 만큼).
export function useKeyboardInset() {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const handles = []
      Keyboard.addListener('keyboardWillShow', (info) => setInset(info?.keyboardHeight || 0))
        .then((h) => handles.push(h)).catch(() => {})
      Keyboard.addListener('keyboardWillHide', () => setInset(0))
        .then((h) => handles.push(h)).catch(() => {})
      return () => { handles.forEach((h) => h.remove?.()) }
    }
    // 웹 폴백
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
