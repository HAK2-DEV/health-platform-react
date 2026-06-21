import { useEffect } from 'react'
import { motion } from 'framer-motion'

// 프로그램 생성 마법사 진입 인트로 — 새 생성 시 ~1.5초 브랜드 화면 후 1단계로 전환.
function WizardIntro({ onDone }) {
  useEffect(() => {
    const t = setTimeout(() => onDone(), 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-white px-6">
      <motion.img
        src="/app-icon.png"
        alt="도담"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
        initial={{ scale: 0.5, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 12, stiffness: 200 }}
        className="w-20 h-20 rounded-3xl shadow-soft mb-5"
      />
      <motion.h1
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        className="text-xl font-bold text-gray-800 mb-1.5 text-center break-keep"
      >
        새 프로그램을 만들어볼까요?
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.3 }}
        className="text-sm text-gray-500 mb-7"
      >
        한 단계씩, 천천히 함께 만들어요
      </motion.p>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className="w-2 h-2 rounded-full bg-emerald-400"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </div>
    </div>
  )
}

export default WizardIntro
