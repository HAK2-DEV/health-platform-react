// 가로 스와이프 뒤로가기 차단 — Day 65.
// iOS Safari 의 edge swipe back 은 시스템 제스처라 CSS overscroll-behavior 로 못 막음.
//
// 전략:
//   1) touchstart: 좌측 30px 내에서 시작된 터치 추적
//   2) touchmove: 그 터치가 오른쪽으로 움직이면 preventDefault → 시스템 스와이프-백 차단
//   3) touchend: 추적 종료
// preventDefault on touchmove 가 touchstart 보다 안정적으로 iOS Safari 시스템 제스처 차단.
//
// 우측 스와이프(앞으로) 는 보통 거의 안 쓰므로 좌측만 차단.
// PWA standalone 모드면 등록 안 함.

export function installSwipeBackBlocker() {
  if (typeof window === 'undefined') return

  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true
  if (isStandalone) return

  // iOS Safari 시스템 스와이프-백 영역 (좌측): 보통 30-40px. 확실히 차단 위해 50px.
  const EDGE_PX = 50

  let startX = 0
  let startY = 0
  let trackingEdge = false

  const onTouchStart = (e) => {
    if (!e.touches || e.touches.length !== 1) {
      trackingEdge = false
      return
    }
    startX = e.touches[0].clientX
    startY = e.touches[0].clientY
    trackingEdge = startX < EDGE_PX
  }

  const onTouchMove = (e) => {
    if (!trackingEdge || !e.touches || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - startX
    const dy = Math.abs(e.touches[0].clientY - startY)
    // 가로 이동이 세로 이동보다 우세하고 오른쪽으로 향함 → 스와이프-백 후보. 차단.
    if (dx > 0 && dx > dy && e.cancelable) {
      e.preventDefault()
    }
  }

  const onTouchEnd = () => {
    trackingEdge = false
  }

  window.addEventListener('touchstart', onTouchStart, { passive: true })
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd, { passive: true })
  window.addEventListener('touchcancel', onTouchEnd, { passive: true })
}
