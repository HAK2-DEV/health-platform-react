import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

// 빵빠레 컨페티 — 부모(relative) 안에서 위→아래로 흩날림. durationMs(기본 10초) 동안만, 이후 멈춤.
const CONFETTI_EMOJI = ['🎉', '🎊', '✨', '⭐', '🌟', '💫', '🎈', '🥳']

function Confetti({ count = 18, fall = 360, durationMs = 10000 }) {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShow(false), durationMs)
    return () => clearTimeout(t)
  }, [durationMs])
  if (!show) return null
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => {
        const left = (i * 5.7 + 3) % 100
        const delay = (i % 6) * 0.22
        const dur = 2.3 + (i % 4) * 0.4
        const e = CONFETTI_EMOJI[i % CONFETTI_EMOJI.length]
        return (
          <motion.span
            key={i}
            className="absolute text-lg select-none"
            style={{ left: `${left}%`, top: -16 }}
            initial={{ y: 0, opacity: 0, rotate: 0 }}
            animate={{ y: [0, fall], opacity: [0, 1, 1, 0], rotate: i % 2 ? 360 : -360, x: i % 2 ? 18 : -18 }}
            transition={{ duration: dur, delay, repeat: Infinity, repeatDelay: 0.7, ease: 'easeIn' }}
          >
            {e}
          </motion.span>
        )
      })}
    </div>
  )
}

export default Confetti
