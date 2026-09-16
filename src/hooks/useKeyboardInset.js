import { useState, useEffect } from 'react'

// 키보드가 뜬 높이(px)를 반환. 하단 고정 바/오버레이(모달 등)를 그만큼 위로 띄우는 데 사용.
//   visualViewport 로 감지 (키보드가 뜨면 뷰포트가 줄어드는 만큼) — iOS·최신 안드에서 동작.
//   ⚠️ 구형 안드(노트9=안드10, adjustNothing)는 visualViewport 가 키보드에 무반응이라 0 을 반환함.
//      일반 페이지 입력칸은 lib/nativeKeyboard 의 포커스 스크롤이 대신 처리하고,
//      ✅ 공용 Modal 안 입력칸은 2026-09-16 해결 — useLegacyKeyboardOpen 으로 «키보드가 떴다» 는 사실만 받아
//      시트를 화면 위쪽에 붙인다(노트9 실측 검증). 개별 fixed 오버레이(신고·미션 만들기 등)는 아직 이 훅의
//      0 을 그대로 쓰므로, 같은 증상이 보고되면 Modal 과 같은 방식을 적용할 것.
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
