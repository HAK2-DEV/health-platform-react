import { useState, useMemo, useRef, useEffect } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'
import { motion, AnimatePresence } from 'framer-motion'
import { Sprout, Droplets, Sun, Book, Info } from 'lucide-react'
import {
  FLOWERS,
  getFlowerByKey,
  pickRandomFlower,
  computeStage,
  computeGrowthRatio,
  getStageLabel,
  getStageEmoji,
  getCollection,
} from '../../lib/gamification'

// 정원 패널 — ProgramDetailPage 의 「성장」 탭 (gamification_type=GARDEN 일 때).
//
// 본인 비전 (project_gamification_garden_mvp_2026-06-05):
//   - 4×4 격자 (16칸). 베타 MVP 는 1식물 사용. 나머지 격자는 「추후 확장」 약속.
//   - 빈 칸 클릭 → 씨앗 심기 (랜덤 꽃 추첨, 무료).
//   - 식물 클릭 → 「물 N / 햇빛 M / 단계 X」 정보 + 물·햇빛 주는 모션.
//   - 5단계 (만개) 도달 시 꽃 정체 공개 + 도감에 추가.
//
// props:
//   participation — program_participants row { growth_state, ... }
//   activeDays    — 인증한 unique 일자 수
//   totalCount    — 누적 미션 인증 횟수
//   programDays   — 프로그램 전체 일수
//   onPlantSeed   — (position, flowerKey) → DB UPDATE 호출. growth_state.garden.plants 업데이트.
//
// 베타 MVP 단순화:
//   - plants 배열에서 첫 항목만 시각화.
//   - 도감은 collection 배열 그대로 표시.

const GRID_ROWS = 4
const GRID_COLS = 4

function GardenPanel({ participation, activeDays, totalCount, programDays, onPlantSeed, onUpdateGarden }) {
  const [selectedCell, setSelectedCell] = useState(null)  // [row, col] — 정보 모달용
  useBodyScrollLock(!!selectedCell)  // 칸 정보 오버레이 — iOS 배경 스크롤 방지
  useBackButtonClose(!!selectedCell, () => setSelectedCell(null))  // 하드웨어 뒤로가기 = 닫기
  // 본인 비전 (Day 65) — 식물 클릭 시 물·햇빛 주는 모션. 본인 결정 「자동 부여 + 모션 시각화」.
  const [careCell, setCareCell] = useState(null)         // [row, col] — 모션 중인 셀
  const careTimer = useRef(null)

  const garden = participation?.growth_state?.garden || {}
  const plants = garden.plants || []
  const collection = garden.collection || []

  // 현재 계산된 단계 (DB stage 와 별개 — 클라이언트에서 매번 계산).
  // 추후 score_ledgers / verifications 누적이 늘면 stage 가 변함.
  const stage = computeStage({ activeDays, totalCount, programDays })
  const growthRatio = computeGrowthRatio({ activeDays, totalCount, programDays })

  // 첫 식물 — 베타 MVP 는 1개만 시각화
  const firstPlant = plants[0] || null
  const flower = firstPlant ? getFlowerByKey(firstPlant.flower_type) : null
  const isRevealed = stage >= 5  // 5단계 만개 시 정체 공개

  // Day 65 — 만개 시 도감 자동 추가 + plants[].revealed/stage 동기화 (DB ↔ 클라이언트 일치).
  // onUpdateGarden 이 있어야 동작. 무한 호출 방지 위해 garden 안 바뀌면 호출 X.
  useEffect(() => {
    if (!firstPlant || !onUpdateGarden) return
    let updatedGarden = garden
    let changed = false

    // plants[0].stage 가 최신 stage 와 다르면 갱신 (시각 일관성)
    if ((firstPlant.stage || 0) !== stage) {
      const updatedPlants = plants.map((p, i) => i === 0 ? { ...p, stage } : p)
      updatedGarden = { ...updatedGarden, plants: updatedPlants }
      changed = true
    }
    // 만개 시 revealed = true
    if (isRevealed && !firstPlant.revealed) {
      const updatedPlants = updatedGarden.plants.map((p, i) => i === 0 ? { ...p, revealed: true } : p)
      updatedGarden = { ...updatedGarden, plants: updatedPlants }
      changed = true
    }
    // 만개 시 도감(collection)에 꽃 추가 (중복 방지)
    if (isRevealed && firstPlant.flower_type && !(updatedGarden.collection || []).includes(firstPlant.flower_type)) {
      updatedGarden = { ...updatedGarden, collection: [...(updatedGarden.collection || []), firstPlant.flower_type] }
      changed = true
    }
    if (changed) onUpdateGarden(updatedGarden)
  }, [stage, isRevealed, firstPlant?.id, firstPlant?.stage, firstPlant?.revealed, firstPlant?.flower_type, onUpdateGarden])

  // 격자 cell 의 식물 매칭 — plants[i].position 으로
  const cellPlant = useMemo(() => {
    const map = new Map()
    plants.forEach(p => {
      if (Array.isArray(p.position)) {
        map.set(`${p.position[0]},${p.position[1]}`, p)
      }
    })
    return map
  }, [plants])

  const handleCellClick = (row, col) => {
    const key = `${row},${col}`
    const existing = cellPlant.get(key)
    if (existing) {
      // 식물 클릭 → 물·햇빛 주는 모션 (1.6초). 그 사이는 정보 모달 X.
      if (careTimer.current) clearTimeout(careTimer.current)
      setCareCell([row, col])
      careTimer.current = setTimeout(() => setCareCell(null), 1600)
      return
    }
    // 빈 칸 — 첫 식물만 허용 (베타 MVP). 이미 1개 있으면 안내.
    if (plants.length >= 1) {
      setSelectedCell([row, col])  // 모달에 「추후 확장」 안내
      return
    }
    // 첫 씨앗 심기 — 랜덤 추첨
    const picked = pickRandomFlower()
    onPlantSeed?.([row, col], picked.key)
  }

  return (
    <div className="space-y-4">
      {/* 헤더 — 현재 단계 + 진행 바 + 정보 버튼 */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getStageEmoji('garden', stage)}</span>
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                {getStageLabel('garden', stage)}
              </p>
              <p className="text-[11px] text-emerald-700">
                단계 {stage}/5
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-sky-700">
              <Droplets className="w-3.5 h-3.5" />
              물 {totalCount}
            </span>
            <span className="inline-flex items-center gap-1 text-amber-700">
              <Sun className="w-3.5 h-3.5" />
              햇빛 {activeDays}
            </span>
            {firstPlant && (
              <button
                type="button"
                onClick={() => setSelectedCell(firstPlant.position)}
                className="p-1 -mr-1 text-emerald-600 hover:bg-emerald-100 rounded-full transition"
                title="내 식물 정보"
                aria-label="내 식물 정보"
              >
                <Info className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="h-2 bg-white/70 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-400 to-teal-500"
            initial={{ width: 0 }}
            animate={{ width: `${growthRatio * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* 4×4 격자 */}
      <div className="bg-amber-50/50 rounded-2xl p-3 border border-amber-100">
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, idx) => {
            const row = Math.floor(idx / GRID_COLS)
            const col = idx % GRID_COLS
            const plant = cellPlant.get(`${row},${col}`)
            const isPlanted = !!plant
            const cellEmoji = isPlanted ? getStageEmoji('garden', stage) : ''

            const isCaring = careCell && careCell[0] === row && careCell[1] === col
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleCellClick(row, col)}
                className={`
                  relative aspect-square rounded-xl flex items-center justify-center transition-all
                  ${isPlanted
                    ? 'bg-gradient-to-br from-emerald-100 to-teal-100 border-2 border-emerald-300 shadow-sm z-10'
                    : 'bg-amber-100/60 border border-amber-200 hover:bg-amber-100 hover:scale-105'}
                  ${isCaring ? 'z-20' : ''}
                `}
                aria-label={isPlanted ? '내 식물' : '빈 흙'}
              >
                {isPlanted ? (
                  <motion.span
                    key={stage}
                    animate={isCaring ? {
                      scale: [1, 1.15, 0.95, 1.1, 1],
                      rotate: [0, -5, 5, -3, 0],
                    } : { scale: 1, rotate: 0 }}
                    transition={isCaring ? { duration: 1.2, ease: 'easeInOut' } : { duration: 0.3 }}
                    className="text-3xl select-none z-10"
                  >
                    {cellEmoji}
                  </motion.span>
                ) : (
                  <span className="text-xs text-amber-500/60">+</span>
                )}

                {/* 물·햇빛 주는 모션 — 식물 클릭 시 1.6초 */}
                <AnimatePresence>
                  {isCaring && (
                    <>
                      {/* 햇빛 광선 — 식물 뒤에서 펄스 */}
                      <motion.div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.6, 0.4, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.4 }}
                      >
                        <div className="w-full h-full bg-gradient-to-br from-amber-200/70 via-yellow-100/40 to-transparent rounded-full" />
                      </motion.div>
                      {/* 물방울 3개 — 위에서 식물로 떨어짐 */}
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={`drop-${i}`}
                          className="absolute pointer-events-none text-base"
                          style={{ left: `${30 + i * 18}%`, top: '-10%' }}
                          initial={{ y: 0, opacity: 0 }}
                          animate={{ y: 60, opacity: [0, 1, 1, 0] }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.9, delay: i * 0.15, ease: 'easeIn' }}
                        >
                          💧
                        </motion.div>
                      ))}
                      {/* +1 floating text — 셀 외부 위/아래로 떠올라 사라짐 (z-30 으로 다른 셀 위에) */}
                      <motion.div
                        className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none text-xs font-bold text-sky-700 whitespace-nowrap z-30 drop-shadow-sm"
                        initial={{ y: 8, opacity: 0 }}
                        animate={{ y: -8, opacity: [0, 1, 1, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.4, delay: 0.2 }}
                      >
                        💧 +물
                      </motion.div>
                      <motion.div
                        className="absolute -bottom-6 left-1/2 -translate-x-1/2 pointer-events-none text-xs font-bold text-amber-700 whitespace-nowrap z-30 drop-shadow-sm"
                        initial={{ y: -8, opacity: 0 }}
                        animate={{ y: 8, opacity: [0, 1, 1, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.4, delay: 0.4 }}
                      >
                        ☀️ +햇빛
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-gray-500 text-center mt-2 leading-relaxed">
          {plants.length === 0
            ? '빈 흙을 클릭해서 씨앗을 심어보세요 🌰'
            : isRevealed && flower
              ? `${flower.emoji} ${flower.name}이(가) 만개했어요! 도감에 추가됐어요.`
              : '미션 인증 = 물 💧 / 매일 첫 인증 = 햇빛 ☀️'}
        </p>
      </div>

      {/* 도감 미니 — 만개한 꽃 컬렉션 */}
      {collection.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Book className="w-4 h-4 text-violet-600" />
            <p className="text-sm font-semibold text-gray-800">나의 식물 도감</p>
            <span className="text-xs text-gray-500 ml-auto">{collection.length}/{FLOWERS.length}</span>
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
            {getCollection(collection).map(f => (
              <div
                key={f.key}
                className="aspect-square flex flex-col items-center justify-center bg-violet-50 rounded-lg p-1"
                title={f.name}
              >
                <span className="text-xl">{f.emoji}</span>
                <span className="text-xs text-violet-700 truncate w-full text-center">{f.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cell 정보 모달 */}
      <AnimatePresence>
        {selectedCell && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedCell(null)}
          >
            <motion.div
              className="bg-white rounded-2xl p-5 pb-8 w-[calc(100%-2rem)] mx-4 sm:max-w-sm sm:mx-0 mb-20 sm:mb-0"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const key = `${selectedCell[0]},${selectedCell[1]}`
                const p = cellPlant.get(key)
                if (p) {
                  const f = getFlowerByKey(p.flower_type)
                  return (
                    <>
                      <div className="text-center mb-3">
                        <p className="text-5xl mb-2">{getStageEmoji('garden', stage)}</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {isRevealed && f ? `${f.emoji} ${f.name}` : '???'}
                        </p>
                        <p className="text-xs text-gray-500">{getStageLabel('garden', stage)} · 단계 {stage}/5</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-sky-50 rounded-xl p-3 text-center">
                          <Droplets className="w-5 h-5 text-sky-600 mx-auto mb-1" />
                          <p className="text-xs text-sky-700">물</p>
                          <p className="text-lg font-bold text-sky-900">{totalCount}</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-3 text-center">
                          <Sun className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                          <p className="text-xs text-amber-700">햇빛</p>
                          <p className="text-lg font-bold text-amber-900">{activeDays}</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500 text-center leading-relaxed mb-3">
                        {isRevealed
                          ? '🎉 만개! 새 씨앗을 받아 다음 칸에 심을 수 있어요 (Phase 2).'
                          : '미션 인증과 매일 출석으로 물·햇빛이 자동으로 부여돼요. 5단계에서 꽃의 정체가 공개돼요!'}
                      </p>
                    </>
                  )
                }
                // 빈 칸 — 추후 확장 안내 (베타 MVP 는 1식물만)
                return (
                  <>
                    <div className="text-center mb-3">
                      <Sprout className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-gray-800">새 씨앗</p>
                      <p className="text-xs text-gray-500">앞으로 다양한 꽃을 심을 수 있는 자리예요</p>
                    </div>
                    <p className="text-[11px] text-gray-500 text-center leading-relaxed mb-3">
                      베타 단계에선 정원에 1개 식물만 키울 수 있어요. 다음 업데이트에서 더 많은 씨앗을 받게 돼요 🌷
                    </p>
                  </>
                )
              })()}
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition"
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default GardenPanel
