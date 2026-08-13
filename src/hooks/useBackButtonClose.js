import { useEffect, useRef } from 'react'

// 하드웨어/브라우저 뒤로가기 = 오버레이 닫기 (공용 훅).
//   열릴 때 history 더미(고유 key) push → 뒤로가기(popstate) 시 onClose 호출.
//   코드로 닫힐 때(뒤로가기 아님)엔, 우리 더미가 아직 최상단이면 history.back() 으로 정리.
//   모달↔모달 전환/네비게이션이 유발한 자기 popstate 를 자기 뒤로가기로 오인하지 않도록
//   key 확인 + 모듈 전역 _ignoreNextPop 플래그로 방어(여러 오버레이가 상태 공유).
//   ※ dev(StrictMode 이중 실행)에선 history 꼬임 → 프로드/네이티브에서만 동작.
//   Modal.jsx 및 모든 커스텀 오버레이가 이 훅을 써서 하드웨어 뒤로가기를 일관 처리한다.
let _seq = 0
let _ignoreNextPop = false

export function useBackButtonClose(isOpen, onClose) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen || import.meta.env.DEV) return
    let viaPop = false
    const myKey = `__bk${++_seq}`
    window.history.pushState({ __bk: true, __bkkey: myKey }, '')
    const onPop = () => {
      if (_ignoreNextPop) { _ignoreNextPop = false; return }
      viaPop = true
      onCloseRef.current?.()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      // 뒤로가기로 닫힌 게 아니고, 우리 더미가 아직 최상단일 때만 정리(네비게이션으로 벗어난 경우 제외)
      if (!viaPop && window.history.state?.__bkkey === myKey) {
        _ignoreNextPop = true
        window.history.back()
        setTimeout(() => { _ignoreNextPop = false }, 0)
      }
    }
  }, [isOpen])
}
