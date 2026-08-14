import { cloneElement, forwardRef, isValidElement, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion'
import { Check, Calendar } from 'lucide-react'

// 주간 스트릭 — "도장 찍기" 강조 연출.
//   playStamp(dayIndex) 호출 시: 카드 확대+딤 → 도장 낙하 → 임팩트(즉시 상태 반영+펀치+잉크링+색종이) → 복귀.
//   영구 상태(찍힌 요일/연속 일수)는 transition 없이 즉시 반영, 일시 연출만 애니메이션.
//   props: count(연속 일수), days([{label,done,today}]), icon(불꽃 노드), showTest(데모 트리거 버튼)
const BRAND = '#22A45C'
const SUB_COLOR = '#F59E0B' // 서브 미션 요일 도장(앰버)
const kindColor = (d) => (d?.kind === 'sub' ? SUB_COLOR : BRAND)
const OVERSHOOT = [0.34, 1.5, 0.64, 1]
const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

// 방사형 색종이 파티클 8개 (고정 각도 — 결정적)
const PARTICLE_COLORS = ['#22A45C', '#34D399', '#FBBF24', '#60A5FA', '#F472B6']
const PARTICLES = Array.from({ length: 8 }, (_, i) => {
  const ang = (Math.PI * 2 * i) / 8
  return { id: i, x: Math.cos(ang) * 26, y: Math.sin(ang) * 26 - 4, color: PARTICLE_COLORS[i % PARTICLE_COLORS.length], rot: i * 47 }
})

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const WeeklyStreak = forwardRef(function WeeklyStreak({ count = 0, days = [], icon = null, showTest = false, variant = 'card', bestStreak = 0, clickReplay = true, iconBg = 'bg-orange-50', title = '주간 스트릭' }, ref) {
  const doneFromProps = () => new Set(days.map((d, i) => (d.done ? i : -1)).filter((i) => i >= 0))
  const [doneSet, setDoneSet] = useState(doneFromProps)
  const [streak, setStreak] = useState(count)
  const [stampIdx, setStampIdx] = useState(null) // 현재 도장 찍는 칸
  const [impacted, setImpacted] = useState(false) // 임팩트(상태 확정) 여부
  const [particlesOn, setParticlesOn] = useState(false)
  const [dim, setDim] = useState(false)
  const [flamePlay, setFlamePlay] = useState(0)   // 도장 연출 시 불꽃(FlameIcon)도 타오르게 하는 신호
  const busyRef = useRef(false)
  // 불꽃 아이콘에 playSignal(도장 시 타오름) + interactive(클릭 반응) 주입. FlameIcon 아니어도 안전.
  const flameNode = isValidElement(icon) ? cloneElement(icon, { playSignal: flamePlay, interactive: clickReplay }) : icon

  const cardRef = useRef(null)
  const cardCtrl = useAnimationControls()
  const stampCtrl = useAnimationControls()
  const cellCtrl = useAnimationControls()
  const flameCtrl = useAnimationControls() // 도장 순간에만 불꽃 타오름

  // idle 시 외부 데이터(props) 동기화 — 애니메이션 중엔 건드리지 않음
  useEffect(() => {
    if (busyRef.current) return
    setDoneSet(doneFromProps())
    setStreak(count)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, count])

  const playStamp = async (dayIndex, { bumpCount = true, noReset = false } = {}) => {
    if (busyRef.current) return
    if (dayIndex == null || dayIndex < 0 || dayIndex >= days.length) return
    busyRef.current = true

    // 7일(전체)이 다 차 있으면 자동 리셋 후 시작 (재생(noReset)에선 유지)
    let baseDone = doneSet
    let baseStreak = streak
    if (!noReset && doneSet.size >= days.length) {
      baseDone = new Set()
      baseStreak = 0
      setDoneSet(baseDone)
      setStreak(0)
    }
    const alreadyDone = baseDone.has(dayIndex)
    const commitState = () => {
      const nd = new Set(baseDone)
      nd.add(dayIndex)
      setDoneSet(nd)
      if (bumpCount && !alreadyDone) setStreak(baseStreak + 1)
    }

    // 모션 감소 설정 — 즉시 결과만 반영
    if (reduceMotion()) {
      commitState()
      busyRef.current = false
      return
    }

    setStampIdx(dayIndex)
    setImpacted(false)
    stampCtrl.set({ y: -34, scale: 1.9, rotate: -14, opacity: 0 })

    // 1) 확대 강조 + 딤 (≈0.44s) — 카드를 화면 상단 중앙으로 이동(transform FLIP, 레이아웃 영향 없음)
    let dx = 0, dy = -32
    const el = cardRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      dx = Math.round(window.innerWidth / 2 - (r.left + r.width / 2))
      dy = Math.round(92 - r.top)
    }
    setDim(true)
    setFlamePlay((p) => p + 1)   // 도장 연출 동안 불꽃(FlameIcon)도 타오르게
    // 불꽃 — 도장 시퀀스 동안만 타오름(밑동 기준 flicker + 주황 glow), 마지막에 원상복귀
    flameCtrl.start({
      scale: [1, 1.2, 0.95, 1.16, 1.05, 1.12, 1],
      rotate: [0, -6, 4, -4, 3, -2, 0],
      filter: [
        'drop-shadow(0 0 0px rgba(249,115,22,0))',
        'drop-shadow(0 0 5px rgba(249,115,22,0.9))',
        'drop-shadow(0 0 2px rgba(249,115,22,0.5))',
        'drop-shadow(0 0 6px rgba(249,115,22,0.95))',
        'drop-shadow(0 0 3px rgba(249,115,22,0.7))',
        'drop-shadow(0 0 5px rgba(249,115,22,0.9))',
        'drop-shadow(0 0 0px rgba(249,115,22,0))',
      ],
      transition: { duration: 1.9, ease: 'easeInOut' },
    })
    await cardCtrl.start({ x: dx, y: dy, scale: 1.45, transition: { duration: 0.44, ease: OVERSHOOT } })

    // 2) 도장 낙하 (≈0.25s)
    await stampCtrl.start({ y: 0, scale: 1, rotate: -6, opacity: 1, transition: { duration: 0.25, ease: 'easeIn' } })

    // 3) 임팩트 — 영구 상태 즉시 반영 + 펀치/잉크/색종이/눌림
    commitState()
    setImpacted(true)
    setParticlesOn(true)
    cellCtrl.start({ scale: [1, 1.32, 1], transition: { duration: 0.32, ease: 'easeOut' } })
    stampCtrl.start({ scale: [1, 1.08, 1], transition: { duration: 0.25 } })
    await wait(600)
    setParticlesOn(false)

    // 4) 복귀 (≈0.4s) — 도장 떠오르며 사라짐 + 딤 아웃 + 카드 원위치
    await Promise.all([
      stampCtrl.start({ y: -26, scale: 1.2, opacity: 0, transition: { duration: 0.4, ease: 'easeIn' } }),
      cardCtrl.start({ x: 0, y: 0, scale: 1, transition: { duration: 0.4, ease: 'easeInOut' } }),
    ])
    setDim(false)
    setStampIdx(null)
    setImpacted(false)
    busyRef.current = false
  }

  // 오늘 칸 도장 (인증 직후 신호용) — 서버 데이터가 이미 반영됐으므로 기본 bumpCount:false
  const playToday = (opts = { bumpCount: false }) => {
    const i = days.findIndex((d) => d.today)
    if (i >= 0) playStamp(i, opts)
  }
  // 축하 다시 보기 — 오늘 찍혀있으면 오늘, 아니면 마지막으로 찍힌 칸을 재생(카운트·리셋 없음)
  const replayCelebrate = () => {
    if (busyRef.current) return
    const todayIdx = days.findIndex((d) => d.today)
    let idx = (todayIdx >= 0 && doneSet.has(todayIdx)) ? todayIdx : -1
    if (idx < 0) for (let i = days.length - 1; i >= 0; i--) { if (doneSet.has(i)) { idx = i; break } }
    if (idx < 0) return // 아직 찍힌 칸 없음 → 축하할 게 없음
    playStamp(idx, { bumpCount: false, noReset: true })
  }
  useImperativeHandle(ref, () => ({ playStamp, playToday, replayCelebrate }))

  // 도장 찍는 칸은 임팩트 전까지 회색(미달성)으로 보여 gray→green 연출
  const cellDone = (i) => (stampIdx === i && !impacted ? false : doneSet.has(i))

  const testTrigger = () => {
    const next = days.findIndex((d, i) => !doneSet.has(i))
    playStamp(next >= 0 ? next : 0)
  }

  // 불꽃 아이콘 (도장 시 flicker)
  const flameEl = (
    <span className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
      <motion.span animate={flameCtrl} style={{ transformOrigin: '50% 90%', display: 'inline-flex' }}>
        {flameNode}
      </motion.span>
    </span>
  )

  // 요일 동그라미들 (도장 연출 포함) — card/wide 공용. 반폭 카드는 7개 넉넉히 들어가게 살짝 작게.
  const cellSize = variant === 'wide' ? 'w-[16px] h-[16px]' : 'w-[18px] h-[18px]'
  const dayCells = days.map((d, i) => {
    const done = cellDone(i)
    const stamping = stampIdx === i
    const col = kindColor(d) // 메인=초록 / 서브=앰버
    return (
      <div key={i} className="relative flex flex-col items-center gap-1">
        <motion.span
          animate={stamping ? cellCtrl : undefined}
          className={`relative ${cellSize} rounded-full flex items-center justify-center`}
          style={{ backgroundColor: done ? col : '#F3F4F6', color: done ? '#fff' : '#D1D5DB' }}
        >
          {stamping && impacted && (
            <motion.span
              className="absolute inset-0 rounded-full border-2"
              style={{ borderColor: col }}
              initial={{ scale: 0.6, opacity: 0.55 }}
              animate={{ scale: 2.7, opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          )}
          <Check className="w-3 h-3" strokeWidth={3} />
        </motion.span>
        <span className={`text-[10px] ${d.today ? 'text-emerald-600 font-bold' : 'text-gray-400'}`}>{d.label}</span>

        <AnimatePresence>
          {stamping &&
            particlesOn &&
            PARTICLES.map((p) => (
              <motion.span
                key={p.id}
                className="absolute top-[10px] left-1/2 w-1.5 h-1.5 rounded-[1px] pointer-events-none"
                style={{ backgroundColor: p.color }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.4, rotate: p.rot }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            ))}
        </AnimatePresence>

        {stamping && (
          <motion.span
            className={`absolute top-0 left-1/2 -translate-x-1/2 ${cellSize} rounded-full flex items-center justify-center pointer-events-none`}
            style={{ backgroundColor: col, color: '#fff', boxShadow: `0 4px 10px ${col}80` }}
            initial={{ y: -34, scale: 1.9, rotate: -14, opacity: 0 }}
            animate={stampCtrl}
          >
            <Check className="w-3 h-3" strokeWidth={3} />
          </motion.span>
        )}
      </div>
    )
  })

  return (
    <>
      {/* 딤 백드롭 — 카드 아래 전체 화면 */}
      <AnimatePresence>
        {dim && (
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(15,23,42,0.24)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      <motion.div
        ref={cardRef}
        animate={cardCtrl}
        onClick={clickReplay ? replayCelebrate : undefined}
        title={clickReplay ? '다시 보기' : undefined}
        className={`relative rounded-2xl p-3.5 bg-white border border-gray-100 shadow-soft ${clickReplay ? 'cursor-pointer' : ''} ${dim ? 'z-50' : ''}`}
      >
        {variant === 'wide' ? (
          // 레퍼런스 와이드 — 좌 텍스트 / 가운데 요일 / 우 불꽃·최고기록
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-shrink-0">
              <p className="text-[11px] font-bold text-gray-900 flex items-center gap-1"><Calendar className="w-3 h-3 text-emerald-600 flex-shrink-0" /> 이번 주 기록</p>
              <p className="text-[14px] font-extrabold text-gray-800 mt-0.5 whitespace-nowrap">{streak}일 연속 성공!</p>
              <p className="text-[10px] text-gray-400 mt-0.5 whitespace-nowrap">꾸준함이 만드는 변화</p>
            </div>
            <div className="flex-1 flex items-center justify-center gap-0.5">{dayCells}</div>
            <div className="flex flex-col items-center flex-shrink-0">
              {flameEl}
              <p className="text-[9px] font-extrabold text-gray-700 leading-none mt-1 whitespace-nowrap">{bestStreak}일 연속</p>
            </div>
          </div>
        ) : (
          // 아이콘 + 컬럼(제목/부제 들여쓰기 정렬) — 추천 페이스 카드와 동일 구조로 제목 높이·정렬 일치
          <>
            <div className="flex items-start gap-2.5">
              <span className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
                <motion.span animate={flameCtrl} style={{ transformOrigin: '50% 90%', display: 'inline-flex' }}>{flameNode}</motion.span>
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-[13px] font-bold text-gray-800 whitespace-nowrap">{title}</span>
                <p className="text-[10px] text-gray-500 mt-1.5 truncate">{streak}일 연속 성공 중</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">{dayCells}</div>
          </>
        )}

        {/* 데모/테스트 트리거 */}
        {showTest && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); testTrigger() }}
            className="mt-3 w-full h-7 rounded-lg bg-emerald-50 text-emerald-600 text-[11px] font-bold border border-emerald-200 hover:bg-emerald-100 transition"
          >
            🟢 도장 찍기 테스트
          </button>
        )}
      </motion.div>
    </>
  )
})

export default WeeklyStreak
