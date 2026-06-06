import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Droplets, Sun } from 'lucide-react'
import {
  getConstellationByKey,
  pickRandomConstellation,
  computeStage,
  computeGrowthRatio,
  getStageLabel,
} from '../../lib/gamification'

// 별자리 패널 — ProgramDetailPage 「성장」 탭 (gamification_type=CONSTELLATION).
//
// 본인 비전 (project_gamification_garden_mvp_2026-06-05):
//   - 본인 이름의 은하계 배경 (어두운 밤하늘)
//   - 5단계 성장에 따라 자동으로 별 5개 점등
//   - 미리 그려진 별자리 (12개 풀, 씨앗 심을 때 랜덤)
//   - 5단계 도달 시 별자리 이름 공개
//
// props 와 동작 흐름은 GardenPanel 과 동일 시그니처:
//   onInitConstellation(key) — 첫 로드 시 별자리가 없으면 호출 → DB UPDATE.

function ConstellationPanel({ participation, activeDays, totalCount, programDays, onInitConstellation, onUpdateConstellation }) {
  const [showInfo, setShowInfo] = useState(false)

  const cState = participation?.growth_state?.constellation || null
  const constellation = cState?.type ? getConstellationByKey(cState.type) : null

  const stage = computeStage({ activeDays, totalCount, programDays })
  const growthRatio = computeGrowthRatio({ activeDays, totalCount, programDays })
  const isRevealed = stage >= 5

  // Day 65 — stars_lit 을 stage 와 동기화 (DB ↔ 클라이언트 일치).
  useEffect(() => {
    if (!cState || !onUpdateConstellation) return
    if ((cState.stars_lit || 0) !== stage) {
      onUpdateConstellation({ ...cState, stars_lit: stage })
    }
  }, [stage, cState?.stars_lit, cState?.type, onUpdateConstellation])

  // 첫 로드 시 별자리 없으면 랜덤 추첨 트리거
  // (실제 호출은 부모에서 useEffect 로. 여기선 UI 만)
  if (!constellation && participation) {
    return (
      <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl p-8 text-center">
        <Sparkles className="w-12 h-12 text-amber-300 mx-auto mb-3 animate-pulse" />
        <p className="text-sm font-semibold text-white mb-2">은하계를 준비 중...</p>
        <button
          type="button"
          onClick={() => {
            const picked = pickRandomConstellation()
            onInitConstellation?.(picked.key)
          }}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm rounded-xl transition backdrop-blur-sm"
        >
          별자리 받기 ✨
        </button>
      </div>
    )
  }

  if (!constellation) return null

  return (
    <div className="space-y-4">
      {/* 헤더 — 단계 + 진행 바 */}
      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-4 border border-violet-100">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-semibold text-violet-800">
              {getStageLabel('constellation', stage)}
            </p>
            <p className="text-[11px] text-violet-700">단계 {stage}/5</p>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-sky-700">
              <Droplets className="w-3.5 h-3.5" />
              빛 {totalCount}
            </span>
            <span className="inline-flex items-center gap-1 text-amber-700">
              <Sun className="w-3.5 h-3.5" />
              밤 {activeDays}
            </span>
          </div>
        </div>
        <div className="h-2 bg-white/70 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-400 to-violet-500"
            initial={{ width: 0 }}
            animate={{ width: `${growthRatio * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* 별자리 SVG — 어두운 밤하늘 배경 + 별 점등 */}
      <button
        type="button"
        onClick={() => setShowInfo(!showInfo)}
        className="w-full block bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 rounded-2xl overflow-hidden relative aspect-square sm:aspect-[4/3]"
      >
        {/* 배경 미세 별들 (장식) */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          {Array.from({ length: 30 }).map((_, i) => {
            // deterministic 분산 — 매 렌더 같은 위치
            const x = ((i * 37) % 100)
            const y = ((i * 53) % 100)
            const r = 0.3 + ((i % 3) * 0.2)
            return <circle key={i} cx={x} cy={y} r={r} fill="white" opacity={0.3 + (i % 4) * 0.15} />
          })}
        </svg>

        {/* 별자리 별 + 연결선 */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          {/* 연결선 — 점등된 별 사이만 */}
          {constellation.edges.map(([from, to], i) => {
            const litFrom = from < stage
            const litTo = to < stage
            if (!litFrom || !litTo) return null
            const [fx, fy] = constellation.stars[from]
            const [tx, ty] = constellation.stars[to]
            return (
              <motion.line
                key={i}
                x1={fx} y1={fy} x2={tx} y2={ty}
                stroke="rgb(196 181 253)"
                strokeWidth="0.3"
                strokeOpacity="0.8"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              />
            )
          })}
          {/* 별 — 점등 여부에 따라 밝기 */}
          {constellation.stars.map(([x, y], i) => {
            const isLit = i < stage
            return (
              <motion.g
                key={i}
                initial={{ scale: 0.6 }}
                animate={{ scale: isLit ? 1.2 : 0.7, opacity: isLit ? 1 : 0.25 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                style={{ transformOrigin: `${x}px ${y}px` }}
              >
                {isLit && (
                  <circle cx={x} cy={y} r="3" fill="rgb(253 230 138)" opacity="0.3" />
                )}
                <circle
                  cx={x} cy={y} r="1.4"
                  fill={isLit ? 'rgb(253 224 71)' : 'rgb(148 163 184)'}
                />
              </motion.g>
            )
          })}
        </svg>

        {/* 별자리 이름 — 만개 시 공개 */}
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <p className="text-sm font-semibold text-white/90 tracking-widest">
            {isRevealed ? constellation.name : '???'}
          </p>
          {isRevealed && (
            <p className="text-[11px] text-violet-200 mt-0.5">별자리 완성!</p>
          )}
        </div>
      </button>

      <p className="text-[11px] text-gray-500 text-center leading-relaxed">
        미션 인증 = 별의 빛 ✨ / 매일 첫 인증 = 별을 잇는 밤하늘 🌙
      </p>

      {showInfo && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 text-sm text-gray-700">
          <p className="mb-2">
            <span className="font-semibold">단계 {stage}/5</span> — {getStageLabel('constellation', stage)}
          </p>
          <p className="text-xs text-gray-600 leading-relaxed">
            {isRevealed
              ? '🎉 별자리가 완성됐어요! 다음 업데이트에서 새 별자리도 받을 수 있어요.'
              : '미션 인증과 매일 출석으로 별이 하나씩 점등돼요. 5단계에서 별자리의 이름이 공개돼요.'}
          </p>
        </div>
      )}
    </div>
  )
}

export default ConstellationPanel
