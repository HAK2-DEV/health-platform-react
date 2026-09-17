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
        // ⚠️ 이 해제를 setTimeout(…, 0) 으로 하면 «경쟁» 이 난다 (2026-09-17 실기기 재현으로 확정).
        //   history.back() 이 유발하는 popstate 도, setTimeout(0) 도 «다음 태스크» 라 순서가 보장되지 않는다.
        //   타임아웃이 먼저 돌면 _ignoreNext 가 이미 false → 그 popstate 가 «사용자 뒤로가기» 로 오인되어
        //   _onPop 이 스택 최상단(= 한 단계 «바깥» 오버레이)의 close() 를 호출한다.
        //   증상: 글쓰기 모달 안에서 사진 편집을 저장하면 크롭 모달과 «글쓰기 모달이 함께» 닫히고
        //   제목·내용이 통째로 사라진다(노트9에서 모달 2개 → 0개로 재현. S25 제보도 동일).
        //   타이밍 경쟁이라 기기·부하에 따라 되기도 하고 안 되기도 해서 원인 파악이 오래 걸렸다.
        //   → 정상 경로에서는 _onPop 이 플래그를 소비하므로, 이 타임아웃은 «popstate 가 아예 안 올 때»
        //     플래그가 영구히 켜진 채 남지 않게 하는 안전망일 뿐이다. 넉넉히 준다.
        setTimeout(() => { _ignoreNext = false }, 300)
      }
    }
  }, [isOpen])
}
