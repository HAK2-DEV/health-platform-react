import { useRef, useEffect } from 'react'
import { useInView, animate } from 'framer-motion'

// 숫자 카운트업 — 요소가 화면에 들어왔을 때 0 → value (easeOut).
//   framer-motion animate() + onUpdate 로 DOM 텍스트만 직접 갱신 → React 리렌더 0회(가벼움).
//   once:true 라 한 번만. value 가 비동기로 도착하면 그때 카운트.
//   decimals: 소수 자릿수(기본 0=정수). format: (v)=>string 커스텀 포맷(있으면 decimals 무시).
function CountUp({ value, duration = 1000, className, play = true, decimals = 0, format }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -12% 0px' })
  const fmt = format || ((v) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }))
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const end = Number(value) || 0
    // play=false (재진입 등) → 카운트업 없이 즉시 최종값
    if (!play) { node.textContent = fmt(end); return }
    if (!inView) return
    if (end === 0) { node.textContent = fmt(0); return }
    const controls = animate(0, end, {
      duration: duration / 1000,
      ease: 'easeOut',
      onUpdate: (v) => { node.textContent = fmt(v) },
    })
    return () => controls.stop()
    // fmt/decimals/format 은 의도적으로 deps 제외 (매 렌더 재생성 → 재실행 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, duration, play])
  return <span ref={ref} className={className}>{play ? fmt(0) : fmt(Number(value) || 0)}</span>
}

export default CountUp
