import { useRef, useLayoutEffect } from 'react'

// 컨테이너 폭에 맞춰 글자 크기를 자동 축소 — 한 줄 유지(줄바꿈/잘림 방지).
//   기기·시스템 폰트마다 글자 폭이 달라 라벨이 잘리는 경우, max→min 범위에서
//   폰트를 줄여 폭 안에 들어맞춤. 부모가 정해진 폭을 줘야 함 (예: flex-1 min-w-0).
//   측정은 useLayoutEffect 에서 페인트 전 동기 실행 → 깜빡임 없음.
function FitText({ children, max = 12, min = 8, step = 0.5, className = '', title }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      let s = max
      el.style.fontSize = `${s}px`
      let guard = 0
      // 넘치면(scrollWidth > clientWidth) 들어맞을 때까지 폰트 축소
      while (s > min && el.scrollWidth > el.clientWidth + 0.5 && guard < 40) {
        s = Math.max(min, s - step)
        el.style.fontSize = `${s}px`
        guard++
      }
    }
    measure()

    // 회전·리사이즈로 폭이 바뀌면 재측정. (폰트 조절로 높이만 변한 경우는 무시 → 루프 방지)
    const parent = el.parentElement || el
    let lastW = parent.clientWidth
    let raf = 0
    const onResize = () => {
      const w = parent.clientWidth
      if (Math.abs(w - lastW) < 1) return
      lastW = w
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
    ro?.observe(parent)
    return () => { cancelAnimationFrame(raf); ro?.disconnect() }
  }, [children, max, min, step])

  return (
    <span
      ref={ref}
      title={title}
      className={`block w-full whitespace-nowrap overflow-hidden ${className}`}
      style={{ fontSize: `${max}px` }}
    >
      {children}
    </span>
  )
}

export default FitText
