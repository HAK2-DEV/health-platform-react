// PWA 업데이트 브리지 — registerSW(main.jsx, React 밖)와 배너 UI(React) 연결.
//   registerType:'prompt' 모드: 새 SW 가 대기하면 onNeedRefresh → notifyNeedRefresh().
//   사용자가 「새로고침」 누르면 applyUpdate() → updateSW(true) (skipWaiting + reload).

let _updateSW = null
const listeners = new Set()

export function setUpdateSW(fn) {
  _updateSW = fn
}

// main.jsx 의 onNeedRefresh 에서 호출 — 구독 중인 배너에 알림
export function notifyNeedRefresh() {
  listeners.forEach(l => l())
}

// 배너 컴포넌트가 구독. 반환값은 해제 함수.
export function onNeedRefresh(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// 「새로고침」 클릭 — 새 SW 활성화 + 페이지 reload (updateSW 가 reload 까지 수행)
export function applyUpdate() {
  if (_updateSW) _updateSW(true)
  else window.location.reload()
}
