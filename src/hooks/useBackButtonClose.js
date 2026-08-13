import { useEffect, useRef } from 'react'

// 하드웨어/브라우저 뒤로가기 = 오버레이 닫기 (스택 인식 공용 훅).
//   여러 오버레이가 겹쳐 열려도 뒤로가기 한 번에 "가장 위(가장 최근에 연) 오버레이 하나만" 닫힌다.
//   동작:
//     · 열릴 때 → 모듈 전역 스택에 push + history 더미 1개 push.
//     · 뒤로가기(popstate) → 단일 공용 리스너가 스택 최상단의 onClose 만 호출.
//     · 코드로 닫힐 때(버튼 등) → 우리 더미가 아직 최상단이면 history.back() 으로 정리
//       (그때 유발되는 popstate 는 _ignoreNext 로 무시).
//   Modal.jsx 와 모든 커스텀 오버레이가 이 훅을 써서 같은 스택을 공유한다.
//   ※ dev(StrictMode 이중 실행)에선 history 꼬임 → 프로드/네이티브에서만 동작.
let _seq = 0
const _stack = []          // [{ id, close, poppedByBack }] — 열린 순서(끝 = 최상단)
let _ignoreNext = false    // 코드 정리용 history.back() 이 유발한 popstate 1회 무시
let _attached = false

function _onPop() {
  if (_ignoreNext) { _ignoreNext = false; return }
  const top = _stack[_stack.length - 1]
  if (!top) return
  // 이 뒤로가기가 최상단 오버레이의 더미를 이미 소비 → 그 오버레이 cleanup 에선 재정리(back) 금지
  top.poppedByBack = true
  top.close()   // isOpen→false → 해당 컴포넌트의 effect cleanup 이 스택에서 자신을 제거
}

function _ensureListener() {
  if (_attached || typeof window === 'undefined') return
  window.addEventListener('popstate', _onPop)
  _attached = true
}

export function useBackButtonClose(isOpen, onClose) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen || import.meta.env.DEV) return
    _ensureListener()
    const entry = { id: ++_seq, close: () => onCloseRef.current?.(), poppedByBack: false }
    _stack.push(entry)
    window.history.pushState({ __bk: entry.id }, '')
    return () => {
      const idx = _stack.indexOf(entry)
      if (idx !== -1) _stack.splice(idx, 1)
      // 뒤로가기로 닫힌 게 아니고(코드로 닫힘), 우리 더미가 아직 최상단이면 history.back() 으로 정리
      if (!entry.poppedByBack && window.history.state?.__bk === entry.id) {
        _ignoreNext = true
        window.history.back()
        setTimeout(() => { _ignoreNext = false }, 0)
      }
    }
  }, [isOpen])
}
