import { motion, useReducedMotion } from 'framer-motion'

// 클레이 바이옴 섬 (2.5D) — 인증(물)·출석(햇빛)이 쌓일수록 섬에 클레이 식물이 늘어난다.
//   v1: 기존 /icons/growth 스프라이트 + CSS 클레이 섬. 실제 카테고리별 섬 아트는 추후 bg 교체.
//   props:
//     biome        — biomeForCategories() 결과 { sky, ground, accent, ambient }
//     plantCount   — 심긴 식물 수 (1..ANCHORS.length) — totalCount 로 산출
//     growthRatio  — 0..1 (전체 무성함) — 스프라이트 성장 단계 결정
//     bloomed      — 만개(5단계) 여부 → 히어로가 꽃으로
//     bloomEmoji   — 만개 시 표시할 꽃 이모지(도감 정체)

const SPRITE = {
  sprout: '/icons/growth/sprout.png',   // 얼굴 달린 히어로
  sapling: '/icons/growth/sapling.png',
  tree: '/icons/growth/tree.png',
  bloom: '/icons/growth/bloom.png',
}

// 섬 위 앵커 — 상대 좌표(%) + 크기 s. 배열 순서대로 채워짐(중앙 히어로 → 바깥으로).
//   y 가 클수록(앞쪽) 크고 z 높게 — 깊이감.
const ANCHORS = [
  { x: 50, y: 58, s: 1.00, hero: true },
  { x: 33, y: 54, s: 0.62 },
  { x: 67, y: 55, s: 0.64 },
  { x: 21, y: 64, s: 0.78 },
  { x: 79, y: 63, s: 0.76 },
  { x: 58, y: 68, s: 0.86 },
  { x: 40, y: 70, s: 0.82 },
  { x: 46, y: 46, s: 0.48 },
  { x: 12, y: 55, s: 0.52 },
  { x: 88, y: 54, s: 0.50 },
  { x: 62, y: 44, s: 0.44 },
  { x: 30, y: 44, s: 0.44 },
]

// 성장 비율 → 주변 식물 스프라이트(히어로 제외)
function spriteFor(ratio) {
  if (ratio < 0.34) return SPRITE.sapling
  return SPRITE.tree
}

function BiomeIsland({ biome, plantCount = 1, growthRatio = 0, bloomed = false, bloomEmoji = '🌸' }) {
  const reduce = useReducedMotion()
  const n = Math.max(1, Math.min(ANCHORS.length, plantCount))
  const shown = ANCHORS.slice(0, n)
  const heroSrc = bloomed ? SPRITE.bloom : SPRITE.sprout

  return (
    <div className="relative w-full" style={{ aspectRatio: '1 / 1', maxHeight: 360, margin: '0 auto' }}>
      {/* 햇빛 글로우 */}
      {!reduce && (
        <motion.div aria-hidden className="absolute pointer-events-none"
          style={{ top: '-6%', right: '-4%', width: '46%', height: '46%', borderRadius: '50%',
            background: `radial-gradient(circle, ${biome.accent}55 0%, transparent 68%)` }}
          animate={{ opacity: [0.45, 0.8, 0.45], scale: [1, 1.06, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} />
      )}

      {/* 반딧불(빛 입자) */}
      {!reduce && [0, 1, 2, 3, 4].map(i => (
        <motion.span key={`f${i}`} aria-hidden className="absolute rounded-full pointer-events-none"
          style={{ left: `${14 + i * 18}%`, top: `${30 + (i % 3) * 12}%`, width: 7, height: 7,
            background: '#FFE9A6', boxShadow: '0 0 8px 3px rgba(255,214,120,.8)' }}
          animate={{ y: [0, -14, 0], x: [0, i % 2 ? 8 : -8, 0], opacity: [0.2, 0.9, 0.2] }}
          transition={{ duration: 3.4 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }} />
      ))}

      {/* 나비 */}
      {!reduce && biome.ambient === 'butterfly' && (
        <motion.div aria-hidden className="absolute text-lg pointer-events-none select-none"
          style={{ left: '30%', top: '34%' }}
          animate={{ x: [0, 40, 10, 50, 0], y: [0, -18, 6, -12, 0], rotate: [0, 8, -6, 4, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}>🦋</motion.div>
      )}

      {/* ── 클레이 섬(타원) ── */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: '4%', width: '84%', height: '30%' }}>
        <div className="w-full h-full" style={{
          borderRadius: '50%',
          background: `linear-gradient(180deg, ${biome.ground[0]} 0%, ${biome.ground[1]} 46%, ${biome.ground[2]} 47%, ${biome.ground[2]} 100%)`,
          boxShadow: `0 24px 34px -16px ${biome.ground[2]}aa, inset 0 3px 0 rgba(255,255,255,.28)`,
        }} />
      </div>

      {/* ── 식물들 ── */}
      {shown.map((a, i) => {
        const grown = 0.8 + 0.35 * growthRatio
        const size = `${Math.round(a.s * 92 * grown)}px`
        const src = a.hero ? heroSrc : spriteFor(growthRatio + (i % 3) * 0.08)
        return (
          <motion.img key={i} src={src} alt="" draggable="false"
            className="absolute select-none"
            style={{
              left: `${a.x}%`, top: `${a.y}%`, width: size, height: size,
              transform: 'translate(-50%, -86%)', transformOrigin: '50% 90%',
              zIndex: Math.round(a.y), filter: `drop-shadow(0 6px 5px ${biome.ground[2]}55)`,
              objectFit: 'contain',
            }}
            initial={reduce ? false : { scale: 0, opacity: 0 }}
            animate={reduce ? {} : {
              scale: 1, opacity: 1,
              rotate: a.hero ? [0, 0] : [-2.5, 2.5, -2.5],
            }}
            transition={reduce ? {} : {
              scale: { type: 'spring', stiffness: 220, damping: 15, delay: i * 0.05 },
              opacity: { duration: 0.3, delay: i * 0.05 },
              rotate: { duration: 4 + (i % 4) * 0.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 },
            }}
            onError={(e) => { e.currentTarget.style.display = 'none' }} />
        )
      })}

      {/* 만개 꽃 배지 — 히어로 위에 정체 공개 */}
      {bloomed && (
        <motion.div className="absolute text-2xl select-none pointer-events-none"
          style={{ left: '50%', top: '30%', transform: 'translate(-50%,-50%)' }}
          initial={{ scale: 0, y: 8 }} animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.4 }}>
          {bloomEmoji}
        </motion.div>
      )}
    </div>
  )
}

export default BiomeIsland
