import { useMemo } from 'react'
import { motion } from 'framer-motion'
import UserAvatar from '../common/UserAvatar'

// ─── Top 3 포디움 — 2-1-3 레이아웃 ───────────────────────────
// 1등 가운데/가장 크게, 2등 왼쪽/3등 오른쪽 작게.
// 랭킹(글로벌) + 프로그램 상세 랭킹 탭 공용.
function PodiumTop3({ top3, userId }) {
  const [second, first, third] = [top3[1], top3[0], top3[2]]

  const slot = (row, place) => {
    if (!row) return <div />
    const isMe = row.user_id === userId
    const styleByPlace = {
      1: { gradient: 'from-yellow-100 via-amber-50 to-yellow-50', border: 'border-amber-300', rankColor: 'text-amber-700', scoreColor: 'text-amber-700', height: 'min-h-[11rem]' },
      2: { gradient: 'from-gray-100 via-gray-50 to-white', border: 'border-gray-300', rankColor: 'text-gray-600', scoreColor: 'text-gray-700', height: 'min-h-[9rem]' },
      3: { gradient: 'from-orange-100 via-amber-50/60 to-white', border: 'border-orange-200', rankColor: 'text-orange-700', scoreColor: 'text-orange-700', height: 'min-h-[8.5rem]' },
    }
    const s = styleByPlace[place]

    return (
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: place === 1 ? 1 : 0.95 }}
        transition={{ duration: 0.45, delay: place === 1 ? 0.2 : place === 2 ? 0.05 : 0.1, ease: [0.34, 1.4, 0.64, 1] }}
        className={`
          relative flex flex-col items-center justify-end ${s.height} pt-7 px-3 pb-3 rounded-card border bg-gradient-to-b shadow-soft
          ${s.gradient} ${isMe ? 'ring-2 ring-emerald-400 border-emerald-400' : s.border}
        `}
      >
        {place === 1 && (
          <motion.div
            initial={{ opacity: 0, y: -10, rotate: -15 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: 0.6, duration: 0.3, ease: 'easeOut' }}
            className="absolute -top-7 text-3xl select-none"
          >
            👑
          </motion.div>
        )}
        <PodiumMedalBadge place={place} />

        <UserAvatar
          avatarPath={row.avatar_path}
          nickname={row.nickname}
          size={place === 1 ? 'lg' : 'md'}
          className="mb-1.5"
          viewable
        />
        {isMe && (
          <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs font-semibold rounded-pill mb-0.5">나</span>
        )}
        <p className={`text-xs font-semibold truncate w-full text-center ${isMe ? 'text-emerald-800' : 'text-gray-800'}`}>
          {row.nickname}
        </p>
        <p className={`text-sm font-bold mt-0.5 ${s.scoreColor}`}>
          {row.total_score}P
        </p>
      </motion.div>
    )
  }

  return (
    <div className="relative bg-white rounded-card-lg shadow-elevated p-4 overflow-hidden">
      <ConfettiBurst />
      <div className="relative grid grid-cols-3 items-end gap-2 pt-3">
        {slot(second, 2)}
        {slot(first, 1)}
        {slot(third, 3)}
      </div>
    </div>
  )
}

// 1·2·3등 원형 메달 뱃지 — 골드/실버/브론즈 그라데이션 + 숫자.
function PodiumMedalBadge({ place }) {
  const styles = {
    1: 'bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-900 shadow-amber-300/60',
    2: 'bg-gradient-to-br from-gray-200 to-gray-400 text-gray-700 shadow-gray-300/60',
    3: 'bg-gradient-to-br from-orange-300 to-amber-600 text-orange-900 shadow-orange-300/60',
  }
  const sizeCls = place === 1 ? 'w-11 h-11 -top-4 text-lg' : 'w-8 h-8 -top-3 text-sm'
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.4 + place * 0.04, duration: 0.35, ease: [0.34, 1.5, 0.64, 1] }}
      className={`absolute left-1/2 -translate-x-1/2 z-10 rounded-full ring-2 ring-white shadow-lg flex items-center justify-center ${sizeCls} ${styles[place]}`}
    >
      <span className="font-bold leading-none">{place}</span>
    </motion.div>
  )
}

// 빵빠레 — 포디움 등장 직후 1회 분출.
const CONFETTI_COLORS = ['#fcd34d', '#34d399', '#fb923c', '#f472b6', '#a78bfa', '#60a5fa']
function ConfettiBurst() {
  const particles = useMemo(() => Array.from({ length: 24 }).map((_, i) => ({
    angle: (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
    dist: 60 + Math.random() * 80,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 4 + Math.random() * 5,
    rot: (Math.random() - 0.5) * 720,
    delay: Math.random() * 0.15,
    isSquare: i % 2 === 0,
  })), [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {particles.map((p, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: Math.cos(p.angle) * p.dist, y: Math.sin(p.angle) * p.dist + 40, opacity: 0, rotate: p.rot }}
          transition={{ delay: p.delay, duration: 1.4, ease: 'easeOut' }}
          style={{
            position: 'absolute', left: '50%', top: '38%',
            width: p.size, height: p.size, backgroundColor: p.color,
            borderRadius: p.isSquare ? '2px' : '50%',
          }}
        />
      ))}
    </div>
  )
}

export default PodiumTop3
