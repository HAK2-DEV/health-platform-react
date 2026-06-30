import { useState, useRef } from 'react'
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion'
import { Droplets } from 'lucide-react'

// 꽃 키우기 — 「물주기 손맛」 슬라이스(2026-06-30). 비주얼은 임시(이모지), 인터랙션 손맛이 핵심.
//   물주기 탭 → 물방울 낙하 + 꽃 흔들림 + ✨ 반짝임 + 성장 포인트 증가 → 단계 상승 시 축포.
//   ※ 데이터(인증=물) 연결·성장 일러스트(에셋)는 다음 슬라이스.
const STAGES = [
  { key: 'seed',   label: '씨앗',    emoji: '🌰', min: 0 },
  { key: 'sprout', label: '새싹',    emoji: '🌱', min: 36 },
  { key: 'leaf',   label: '잎',      emoji: '🌿', min: 96 },
  { key: 'bud',    label: '꽃봉오리', emoji: '🌷', min: 180 },
  { key: 'bloom',  label: '활짝',    emoji: '🌸', min: 300 },
]
const PER_WATER = 12

let _id = 0
const uid = () => ++_id

function WateringFlower() {
  const [points, setPoints] = useState(0)
  const [drops, setDrops] = useState([])       // 물방울
  const [sparks, setSparks] = useState([])      // 반짝임
  const [justGrew, setJustGrew] = useState(false)
  const flower = useAnimationControls()
  const lastStageRef = useRef(0)

  const stageIdx = STAGES.reduce((acc, s, i) => (points >= s.min ? i : acc), 0)
  const stage = STAGES[stageIdx]
  const next = STAGES[stageIdx + 1] || null
  const toNext = next ? Math.min(100, Math.round(((points - stage.min) / (next.min - stage.min)) * 100)) : 100

  const water = () => {
    // 물방울 6~8개 — 위에서 꽃으로 낙하
    const newDrops = Array.from({ length: 7 }, () => ({ id: uid(), x: (Math.random() * 80 - 40) }))
    setDrops(d => [...d, ...newDrops])
    // 꽃 반응 — 통통 + 살짝 흔들
    flower.start({ scale: [1, 1.16, 0.97, 1], rotate: [0, -5, 5, 0], transition: { duration: 0.55, ease: 'easeOut' } })

    const np = points + PER_WATER
    setPoints(np)

    // 단계 상승 감지 → 축포(반짝임 다발 + 큰 팝)
    const newStageIdx = STAGES.reduce((acc, s, i) => (np >= s.min ? i : acc), 0)
    if (newStageIdx > lastStageRef.current) {
      lastStageRef.current = newStageIdx
      setJustGrew(true)
      setTimeout(() => setJustGrew(false), 1100)
      burstSparks(16)
      flower.start({ scale: [1, 1.4, 1], transition: { duration: 0.7, ease: 'backOut' } })
    } else {
      burstSparks(5)
    }
  }

  const burstSparks = (n) => {
    const s = Array.from({ length: n }, () => ({
      id: uid(),
      x: Math.random() * 120 - 60,
      y: -(Math.random() * 70 + 20),
    }))
    setSparks(p => [...p, ...s])
  }

  const reset = () => { setPoints(0); lastStageRef.current = 0 }

  return (
    <div className="relative w-[360px] max-w-full mx-auto select-none">
      {/* 무대 — 하늘 그라데이션 + 해 */}
      <div className="relative h-[360px] rounded-3xl overflow-hidden bg-gradient-to-b from-sky-100 via-sky-50 to-emerald-50 shadow-elevated">
        <motion.div
          className="absolute top-4 right-5 text-4xl"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 40, ease: 'linear' }}
        >☀️</motion.div>

        {/* 단계 배지 */}
        <div className="absolute top-3 left-3 z-20 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/80 backdrop-blur text-[12px] font-bold text-emerald-700 shadow-sm">
          {stage.emoji} {stage.label}
        </div>

        {/* 물방울 — 위에서 낙하 */}
        <AnimatePresence>
          {drops.map(d => (
            <motion.div
              key={d.id}
              className="absolute left-1/2 top-10 w-2 h-3 rounded-full bg-sky-400/80"
              style={{ x: d.x }}
              initial={{ y: 0, opacity: 0.9, scaleY: 1 }}
              animate={{ y: 190, opacity: [0.9, 0.9, 0], scaleY: 1.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeIn' }}
              onAnimationComplete={() => setDrops(p => p.filter(x => x.id !== d.id))}
            />
          ))}
        </AnimatePresence>

        {/* 꽃 + 화분 — 하단 중앙 */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-6">
          {/* 반짝임 — 꽃 주변에서 퍼짐 */}
          <div className="relative">
            <AnimatePresence>
              {sparks.map(s => (
                <motion.span
                  key={s.id}
                  className="absolute left-1/2 bottom-10 text-[14px]"
                  initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
                  animate={{ x: s.x, y: s.y, opacity: 0, scale: 1.2 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  onAnimationComplete={() => setSparks(p => p.filter(x => x.id !== s.id))}
                >✨</motion.span>
              ))}
            </AnimatePresence>

            {/* 꽃 (이모지 임시) */}
            <motion.div animate={flower} className="text-[88px] leading-none drop-shadow-sm" style={{ transformOrigin: 'bottom center' }}>
              {stage.emoji}
            </motion.div>
          </div>
          {/* 화분 */}
          <div className="w-24 h-10 -mt-2 rounded-b-2xl rounded-t-md bg-gradient-to-b from-orange-300 to-orange-400 shadow-inner" />
          <div className="w-28 h-2 rounded-full bg-orange-500/20 mt-0.5" />
        </div>

        {/* 단계 상승 토스트 */}
        <AnimatePresence>
          {justGrew && (
            <motion.div
              className="absolute inset-x-0 top-16 flex justify-center z-30"
              initial={{ y: 10, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -10, opacity: 0 }}
            >
              <span className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-sm font-extrabold shadow-lg">
                🎉 {stage.label}(으)로 자랐어요!
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 진행바 + 물주기 버튼 */}
      <div className="mt-3 px-1">
        <div className="flex items-center justify-between text-[12px] text-gray-500 mb-1">
          <span>성장 {points}p</span>
          <span>{next ? `다음 「${next.label}」까지 ${100 - toNext}%` : '활짝 폈어요! 🌸'}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <motion.div className="h-full rounded-full bg-emerald-400" animate={{ width: `${toNext}%` }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} />
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <motion.button
          type="button"
          onClick={water}
          whileTap={{ scale: 0.94 }}
          className="flex-1 h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 transition"
        >
          <Droplets className="w-5 h-5" /> 물 주기
        </motion.button>
        <button type="button" onClick={reset} className="px-4 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm font-bold transition">
          리셋
        </button>
      </div>
      <p className="text-[11px] text-gray-400 text-center mt-2">데모 — 실제로는 「인증 = 물 주기」로 연결돼요. 비주얼은 임시(이모지)예요.</p>
    </div>
  )
}

export default WateringFlower
