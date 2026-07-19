import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { playSuccessChime } from '../../lib/sound'

// 제출 완료 축하 연출 (미션·퀴즈 공용).
//   ① 빈 아이콘이 Y축으로 회전하며 부드럽게 안착(회전→등장을 하나의 연속 동작으로 — 끊김 방지)
//   ② 원본에서 오려낸 체크 조각이 3D로 찍히듯(rotateX 오버슛 + 아래 그림자) — empty 와 같은 박스/object-contain 로 자동 정렬
//   ③ 별·확산 링 → "제출 완료!" · 포인트 배지 · 확인 버튼이 아래→위 순차 페이드인
// props:
//   emptySrc, checkSrc : 빈 아이콘 / 체크 조각 PNG (같은 원본에서 파생, 동일 크기)
//   checkOrigin        : 체크 중심 transformOrigin (예: '51% 54%')
//   label, points, pending, onDone
const BOUNCE = [0.34, 1.5, 0.64, 1]      // 체크 스탬프 오버슛
const SETTLE = [0.16, 1.0, 0.28, 1]      // 회전 감속 안착(부드럽게)
const SPARKS = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI * 2 * i) / 6 - Math.PI / 2
  return { x: Math.cos(a) * 58, y: Math.sin(a) * 58, rot: i * 44 }
})

function SubmitCelebration({ emptySrc, checkSrc, checkOrigin = '51% 54%', label = '제출 완료!', points = 0, pending = false, onDone }) {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  useEffect(() => { if (reduce) onDone?.() }, [reduce, onDone])
  // 효과음은 체크 조각이 찍히는 순간에 맞춰 재생(스탬프 delay 0.82s). 예전엔 제출 onSuccess 에서
  // 즉시 울려 소리가 애니보다 먼저 났음 → 여기로 옮겨 미션·퀴즈 공용으로 싱크.
  useEffect(() => {
    if (reduce) return
    const t = setTimeout(() => playSuccessChime(), 860)
    return () => clearTimeout(t)
  }, [reduce])
  if (reduce) return null

  const fadeUp = (delay) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.35, ease: 'easeOut' } })

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm px-8"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
    >
      <div style={{ perspective: 1000 }} className="relative w-32 h-32 flex items-center justify-center">
        {/* 확산 링 — 체크 박히는 순간 */}
        <motion.span
          className="absolute w-24 h-24 rounded-full border-[3px] border-emerald-300"
          initial={{ scale: 0.45, opacity: 0 }}
          animate={{ scale: [0.45, 2.5], opacity: [0.5, 0] }}
          transition={{ delay: 1.18, duration: 0.6, ease: 'easeOut' }}
        />

        {/* ①+② 빈 아이콘 — 회전하며 부드럽게 안착 (연속 동작, 끊김 없음) */}
        <motion.img
          src={emptySrc} alt="" aria-hidden="true"
          className="absolute inset-0 w-full h-full object-contain drop-shadow-xl"
          initial={{ scale: 0.42, rotateY: -560, opacity: 0 }}
          animate={{ scale: [0.42, 1.06, 1], rotateY: [-560, 0, 0], opacity: [0, 1, 1] }}
          transition={{ duration: 0.82, ease: SETTLE, times: [0, 0.86, 1], opacity: { duration: 0.24, ease: 'easeOut' } }}
        />

        {/* ③ 원본 체크 조각 — 회전 안착 직후 3D 스탬프 (empty 와 같은 박스+object-contain 자동 정렬) */}
        <motion.img
          src={checkSrc} alt="" aria-hidden="true"
          className="absolute inset-0 w-full h-full object-contain"
          style={{ transformOrigin: checkOrigin, filter: 'drop-shadow(0 7px 5px rgba(16,110,64,0.4))' }}
          initial={{ scale: 0.2, rotateX: 55, y: -12, opacity: 0 }}
          animate={{ scale: [0.2, 1.3, 1], rotateX: [55, -8, 0], y: [-12, 4, 0], opacity: [0, 1, 1] }}
          transition={{ delay: 0.82, duration: 0.5, ease: BOUNCE, opacity: { delay: 0.82, duration: 0.16 } }}
        />

        {/* 반짝이 별 */}
        {SPARKS.map((s, i) => (
          <motion.span
            key={i} className="absolute text-amber-400"
            initial={{ x: 0, y: 0, scale: 0, opacity: 0, rotate: 0 }}
            animate={{ x: s.x, y: s.y, scale: [0, 1, 0.5], opacity: [0, 1, 0], rotate: s.rot }}
            transition={{ delay: 1.2, duration: 0.62, ease: 'easeOut' }}
          >
            <Star className="w-4 h-4 fill-current" />
          </motion.span>
        ))}
      </div>

      {/* 텍스트 · 포인트 배지 · 확인 버튼 — 아래에서 위로 순차 페이드인 */}
      <div className="flex flex-col items-center gap-3 mt-1">
        <motion.h2 className="text-[22px] font-extrabold text-gray-900" {...fadeUp(1.34)}>{label}</motion.h2>
        <motion.div
          className="inline-flex items-center gap-1 px-3.5 h-8 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-[14px] font-extrabold"
          {...fadeUp(1.48)}
        >
          <Star className="w-3.5 h-3.5 fill-current" /> {pending ? '승인 후 ' : ''}+{points}P
        </motion.div>
        <motion.button
          type="button" onClick={onDone}
          className="mt-1 h-11 px-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[15px] transition"
          {...fadeUp(1.62)}
        >
          확인
        </motion.button>
      </div>
    </motion.div>
  )
}

export default SubmitCelebration
