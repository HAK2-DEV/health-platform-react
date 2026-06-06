// 가로 스와이프 뒤로가기 차단 — Day 65.
// iOS Safari 의 edge swipe back 은 시스템 제스처라 CSS overscroll-behavior 로 못 막음.
// 좌우 가장자리 ~12px 영역에서 시작되는 touchstart 를 preventDefault 해 차단.
//
// 부작용 최소화 위해:
//   - 좌우 12px 만 (좀 더 좁히면 회피 가능하지만 일반 터치 영향도 줄임)
//   - passive: false 필수 (preventDefault 가능해야 함)
//   - PWA standalone 모드에서는 등록 안 함 (이미 swipe-back 동작 X)

export function installSwipeBackBlocker() {
  if (typeof window === 'undefined') return

  // PWA standalone 모드면 시스템 스와이프-백 자체가 없으므로 핸들러 등록 불필요
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true
  if (isStandalone) return

  const EDGE_PX = 12

  const onTouchStart = (e) => {
    if (!e.touches || e.touches.length !== 1) return
    const x = e.touches[0].clientX
    if (x < EDGE_PX || x > window.innerWidth - EDGE_PX) {
      // 가장자리 터치 → 시스템 스와이프-백 후보. preventDefault 로 차단.
      // cancelable 체크 — 비활성 시 호출하면 콘솔 경고 발생.
      if (e.cancelable) e.preventDefault()
    }
  }

  // passive: false — preventDefault 가능
  window.addEventListener('touchstart', onTouchStart, { passive: false })
}
