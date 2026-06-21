import { useRef, useEffect } from 'react'
import { useInView, animate } from 'framer-motion'

// 숫자 카운트업 — 요소가 화면에 들어왔을 때 0 → value (easeOut).
//   framer-motion animate() + onUpdate 로 DOM 텍스트만 직접 갱신 → React 리렌더 0회(가벼움).
//   once:true 라 한 번만. value 가 비동기로 도착하면 그때 카운트.
function CountUp({ value, duration = 1000, className }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -12% 0px' })
  useEffect(() => {
    const node = ref.current
    if (!node || !inView) return
    const end = Number(value) || 0
    if (end === 0) { node.textContent = '0'; return }
    const controls = animate(0, end, {
      duration: duration / 1000,
      ease: 'easeOut',
      onUpdate: (v) => { node.textContent = Math.round(v).toLocaleString() },
    })
    return () => controls.stop()
  }, [inView, value, duration])
  return <span ref={ref} className={className}>0</span>
}

export default CountUp
