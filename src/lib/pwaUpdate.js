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
  // 업데이트 reload 표시 — reload 후 SplashScreen 이 이 플래그를 보고 초기 스플래시를 생략한다
  //   (이미 업데이트 스플래시=3D 새싹을 봤으므로 로딩화면 2번 노출 방지). sessionStorage 는 reload 후에도 유지.
  try { sessionStorage.setItem('pwa-updating', '1') } catch { /* sessionStorage 미지원 */ }
  if (_updateSW) _updateSW(true)
  else window.location.reload()
}
