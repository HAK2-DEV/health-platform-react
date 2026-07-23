import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

// 탭하면 달리는 러너 스프라이트 — 30프레임 순환(체커보드 제거·높이 정규화).
//   탭할수록 speed↑ → 프레임 가속 + 상체 앞으로 숙임(스프린트). 안 누르면 서서히 감속 → 정지(1번 프레임).
//   1탭 ≈ 4초 지속(TAP_BOOST/DECAY 로 조절). 달리기 진행률 러너로 사용. props: size(px)
const FRAMES = Array.from({ length: 30 }, (_, i) => `/icons/running/run/${i + 1}.png`)
const MAX = 6
const TAP_BOOST = 1.3      // 탭 1회당 speed 증가량
const DECAY = 0.05         // 150ms 마다 감소량 → 1.3 / 0.05 * 150ms ≈ 3.9초

export default function TapRunner({ size = 20 }) {
  const [frame, setFrame] = useState(0)
  const [speed, setSpeed] = useState(0)   // 렌더용(상체 숙임) — 부드럽게 감소
  const speedRef = useRef(0)              // 프레임 루프가 읽는 최신 speed
  const frameTimer = useRef(null)
  const decayTimer = useRef(null)

  const setSp = (v) => { speedRef.current = v; setSpeed(v) }

  // 프레임 루프 — 재귀 setTimeout 으로 매 프레임 speed 에 맞는 지연을 계산(감속 중에도 끊김 없음).
  useEffect(() => {
    let alive = true
    const loop = () => {
      if (!alive) return
      const s = speedRef.current
      if (s <= 0.02) { setFrame(0); frameTimer.current = setTimeout(loop, 90); return } // 멈춤=선 자세
      setFrame((f) => (f + 1) % FRAMES.length)
      frameTimer.current = setTimeout(loop, Math.max(18, 60 - s * 7))                   // 빠를수록 짧게
    }
    loop()
    return () => { alive = false; clearTimeout(frameTimer.current) }
  }, [])

  // 감속 루프 — 150ms 마다 speed 감소. 1탭이 약 4초 지속.
  useEffect(() => {
    decayTimer.current = setInterval(() => {
      if (speedRef.current > 0) setSp(Math.max(0, +(speedRef.current - DECAY).toFixed(3)))
    }, 150)
    return () => clearInterval(decayTimer.current)
  }, [])

  const tap = (e) => {
    e.stopPropagation()
    setSp(Math.min(speedRef.current + TAP_BOOST, MAX))
  }

  const running = speed > 0.02

  return (
    <motion.button
      type="button"
      onClick={tap}
      aria-label="달리기"
      className="outline-none touch-manipulation shrink-0"
      style={{ width: size, height: size, transformOrigin: '50% 82%' }}
      animate={{ rotate: running ? 2 + speed * 3.2 : 0 }}
      transition={{ rotate: { duration: 0.3, ease: 'easeOut' } }}
    >
      {/* 모든 프레임을 겹쳐두고 현재 프레임만 표시 → 프리로드 + 깜빡임 없음 */}
      <div className="relative w-full h-full">
        {FRAMES.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            aria-hidden="true"
            draggable="false"
            className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
            style={{ opacity: (running ? i === frame : i === 0) ? 1 : 0 }}
          />
        ))}
      </div>
    </motion.button>
  )
}
