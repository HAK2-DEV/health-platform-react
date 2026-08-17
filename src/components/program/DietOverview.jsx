import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronDown, Pencil, X } from 'lucide-react'
import { NavCard, Icon3D } from './ProgramHome'
import { MEAL_ICON, MEAL_STREAK_ICON } from '../../lib/mealIcons'
import { Reveal, useBarGrow, barGrowStyle, SPRING_EASE } from './statsAnim'
import { getSignedUrls } from '../../lib/signedUrls'
import WeeklyStreak from './WeeklyStreak'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

const MEAL_MACROS = [
  { key: 'carb', label: '탄수', text: 'text-amber-600', dot: 'bg-amber-400' },
  { key: 'protein', label: '단백', text: 'text-sky-600', dot: 'bg-sky-400' },
  { key: 'fat', label: '지방', text: 'text-rose-500', dot: 'bg-rose-400' },
]

const MACRO = {
  carb: { name: '탄수화물', hex: '#fbbf24' },
  protein: { name: '단백질', hex: '#38bdf8' },
  fat: { name: '지방', hex: '#f43f5e' },
}

// 식단 카테고리 개요 — 진행현황(도넛) | [스트릭/주간추이] · 끼니별 · 영양평가 · 메뉴.
//   애니메이션은 통계와 동일 유틸(statsAnim): 링 그리기+카운트업, 막대 자람, 페이드업.

const MEAL_DEFAULT = [
  { key: 'breakfast', label: '아침', emoji: '🌅', kcal: 0, done: false },
  { key: 'lunch', label: '점심', emoji: '☀️', kcal: 0, done: false },
  { key: 'dinner', label: '저녁', emoji: '🌙', kcal: 0, done: false },
  { key: 'snack', label: '간식', emoji: '🍪', kcal: 0, done: false },
]

const DAILY_VALUE = [
  { key: 'kcal', label: '에너지', unit: 'kcal', dv: 2000, bar: 'bg-gray-400' },
  { key: 'carb', label: '탄수화물', unit: 'g', dv: 324, bar: 'bg-amber-400' },
  { key: 'protein', label: '단백질', unit: 'g', dv: 55, bar: 'bg-sky-400' },
  { key: 'fat', label: '지방', unit: 'g', dv: 54, bar: 'bg-rose-400' },
]

// 매크로 상태 도넛 — 링 길이 = 목표 대비 진행(kcal/goal), 그 안을 탄단지 비율로 색칠.
//   선택 시 그 "조각만" 팝(scale) + 나머지 흐림. (viewBox 120 고정 → 확대해도 안 잘림, StatusDonut 동일)
function MacroStatusDonut({ today, goal, selectedKey = null, onSelect, size = 120 }) {
  const r = 46, C = 2 * Math.PI * r, GAP = 3, stroke = 15
  const macros = today.carb + today.protein + today.fat
  const progress = goal > 0 ? Math.min(1, (today.kcal || 0) / goal) : 0   // 목표 대비 채움(0~1)
  const filled = progress * C
  const segs = [{ key: 'carb', v: today.carb }, { key: 'protein', v: today.protein }, { key: 'fat', v: today.fat }]
  const active = macros > 0 ? segs.filter((s) => s.v > 0) : []
  let cum = 0
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#eef2f0" strokeWidth={stroke} />
        {active.map((s) => {
          const seg = (s.v / macros) * filled
          const len = Math.max(0, seg - (active.length > 1 ? GAP : 0))
          const off = -cum; cum += seg
          const isSel = s.key === selectedKey
          const dim = selectedKey != null && !isSel
          return (
            <circle key={s.key} cx="60" cy="60" r={r} fill="none" stroke={MACRO[s.key].hex} strokeWidth={stroke}
              strokeDasharray={`${len} ${C}`} strokeDashoffset={off} onClick={() => onSelect?.(s.key)}
              style={{ cursor: 'pointer', opacity: dim ? 0.28 : 1, transformBox: 'view-box', transformOrigin: 'center',
                transform: isSel ? 'rotate(-90deg) scale(1.1)' : 'rotate(-90deg)', transition: `transform .3s ${SPRING_EASE}, opacity .2s ease` }} />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[10px] text-gray-400 leading-none">오늘 섭취</span>
        <span className="font-extrabold text-gray-900 tabular-nums leading-none mt-0.5" style={{ fontSize: Math.round(size * 0.18) }}>{(today.kcal || 0).toLocaleString()}</span>
        <span className="text-[9px] text-gray-400 leading-none mt-0.5">kcal</span>
        <span className="text-[8px] text-gray-300 leading-none mt-0.5">/ {goal.toLocaleString()}</span>
      </div>
    </div>
  )
}

// 도넛 + 범례(색점 리스트) — 확대 모달용. 행/세그먼트 클릭 → 링 확대 + 그 행 %↔g 전환.
function DonutMacros({ today, goal }) {
  const [sel, setSel] = useState(null)
  const tot = today.carb + today.protein + today.fat
  const pc = tot > 0 ? Math.round((today.carb / tot) * 100) : 0
  const pp = tot > 0 ? Math.round((today.protein / tot) * 100) : 0
  const pf = tot > 0 ? Math.max(0, 100 - pc - pp) : 0
  const rows = [
    { key: 'carb', name: '탄수화물', v: today.carb, pct: pc },
    { key: 'protein', name: '단백질', v: today.protein, pct: pp },
    { key: 'fat', name: '지방', v: today.fat, pct: pf },
  ]
  const toggle = (k) => setSel((s) => (s === k ? null : k))
  return (
    <div className="flex items-center gap-2.5">
      <MacroStatusDonut today={today} goal={goal} selectedKey={sel} onSelect={toggle} size={120} />
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {rows.map((r) => {
          const on = sel === r.key
          const dim = sel != null && !on
          return (
            <button key={r.key} type="button" onClick={() => toggle(r.key)}
              className={`flex items-center gap-2 rounded-xl px-2 py-2 transition ${on ? 'bg-gray-50' : ''}`} style={{ opacity: dim ? 0.4 : 1 }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: MACRO[r.key].hex }} />
              <span className="text-[12px] font-semibold text-gray-700 flex-1 text-left whitespace-nowrap">{r.name}</span>
              <span className="text-[15px] font-extrabold tabular-nums whitespace-nowrap flex-shrink-0" style={{ color: MACRO[r.key].hex }}>{on ? `${r.v}g` : `${r.pct}%`}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// 컴팩트 도넛 — 카드 기본(반폭). 탭하면 확대 모달. (상세와 동일한 MacroStatusDonut, 선택 없이)
function DonutCompact({ today, goal, onClick }) {
  return (
    <button type="button" onClick={onClick} className="active:scale-95 transition" aria-label="영양 상세 보기">
      <MacroStatusDonut today={today} goal={goal} size={116} />
    </button>
  )
}

// 접시 확대 모달 — 스프링으로 커지며 링 그려짐 + 수치 등장
function DonutDetailModal({ open, onClose, today, goal }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(15,23,42,0.45)' }} onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.82, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.42, ease: [0.34, 1.56, 0.64, 1] }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[15px] font-bold text-gray-800">오늘의 영양</h3>
              <button type="button" onClick={onClose} className="text-gray-300 hover:text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <DonutMacros today={today} goal={goal} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// 참여자 목표 kcal 편집기
function GoalEditor({ goal, onChange }) {
  const [editing, setEditing] = useState(false)
  return editing ? (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(Math.max(500, goal - 100))} className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 text-sm leading-none">−</button>
      <span className="text-[12px] font-bold tabular-nums w-14 text-center">{goal.toLocaleString()}</span>
      <button type="button" onClick={() => onChange(goal + 100)} className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 text-sm leading-none">＋</button>
      <button type="button" onClick={() => setEditing(false)} className="text-[11px] text-emerald-600 font-bold ml-1">완료</button>
    </div>
  ) : (
    <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-emerald-600 transition">
      <Pencil className="w-3 h-3" /> 내 목표 {goal.toLocaleString()} kcal
    </button>
  )
}

// (주간 스트릭은 공용 WeeklyStreak 컴포넌트 사용 — 도장 팝업 애니메이션·개요 통일성)

// 주간 추이 막대 — 통계 유틸(useBarGrow)로 바닥에서 자라남
function TrendBars({ data, max, big = false }) {
  const [ref, grown, rm] = useBarGrow()
  return (
    <div ref={ref} className="flex items-end justify-between gap-1.5 h-full">
      {data.map((d, i) => {
        const last = i === data.length - 1
        const h = max > 0 ? Math.max(4, (d.kcal / max) * 100) : 4
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
            {big && <span className={`text-[9px] tabular-nums ${last ? 'text-emerald-600 font-bold' : 'text-gray-400'}`}>{d.kcal ? d.kcal.toLocaleString() : ''}</span>}
            <div className="w-full rounded-t-md" style={{ height: `${h}%`, background: last ? '#10b981' : '#a7f3d0', ...barGrowStyle(grown, rm, i) }} />
            <span className={`text-[9px] ${last ? 'text-emerald-600 font-bold' : 'text-gray-400'}`}>{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function WeeklyTrendMini({ week, onOpen }) {
  const max = Math.max(1, ...week.map((d) => d.kcal))
  return (
    <button type="button" onClick={onOpen} className="rounded-2xl p-3 bg-white border border-gray-100 shadow-soft text-left w-full h-full flex flex-col hover:bg-gray-50/60 transition">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-bold text-gray-700">주간 추이</span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
      </div>
      <div className="flex-1 min-h-[48px]"><TrendBars data={week} max={max} /></div>
    </button>
  )
}

// 주간 칼로리 추이 팝업 — 스프링 등장 + 막대 자라남
function WeeklyTrendModal({ open, onClose, week }) {
  const vals = week.map((d) => d.kcal).filter((v) => v > 0)
  const max = Math.max(1, ...week.map((d) => d.kcal))
  const avg = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: 'rgba(15,23,42,0.45)' }} onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.84, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-gray-800">주간 칼로리 추이</h3>
              <button type="button" onClick={onClose} className="text-gray-300 hover:text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="h-44"><TrendBars data={week} max={max} big /></div>
            <div className="mt-4 flex justify-between text-[12px]">
              <span className="text-gray-400">평균 <b className="text-gray-700">{avg.toLocaleString()}</b>kcal</span>
              <span className="text-gray-400">최고 <b className="text-gray-700">{Math.max(0, ...week.map((d) => d.kcal)).toLocaleString()}</b>kcal</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function MealStatus({ meals, onMealClick }) {
  return (
    <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft">
      <h3 className="text-[13px] font-bold text-gray-800 mb-3">끼니별 현황 <span className="text-[10px] font-normal text-gray-400">· 탭하면 상세</span></h3>
      <div className="grid grid-cols-4 gap-2">
        {meals.map((m) => (
          <button key={m.key} type="button" onClick={m.done ? () => onMealClick(m) : undefined} disabled={!m.done}
            className={`rounded-xl py-2.5 flex flex-col items-center gap-1 border transition ${m.done ? 'border-emerald-100 bg-emerald-50/50 active:scale-95 cursor-pointer' : 'border-gray-100 bg-gray-50 cursor-default'}`}>
            <Icon3D src={MEAL_ICON[m.key]} emoji={m.emoji} className="w-7 h-7" />
            <span className={`text-[11px] font-semibold ${m.done ? 'text-gray-600' : 'text-gray-400'}`}>{m.label}</span>
            {m.done
              ? <span className="text-[10px] font-bold text-emerald-600 tabular-nums">{m.kcal}kcal</span>
              : <span className="text-[10px] leading-none">&nbsp;</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// 끼니 상세 — 화면 중앙 팝업(부드럽게). 사진 → 음식 카드 → 하단 칼로리·탄단지.
function MealDetailModal({ meal, onClose }) {
  const [imgUrl, setImgUrl] = useState(null)
  useBodyScrollLock(!!meal)
  const imgPath = meal?.imagePath || null
  useEffect(() => {
    if (!imgPath) return
    let alive = true
    getSignedUrls('verification-images', [imgPath]).then((mm) => { if (alive) setImgUrl(mm[imgPath] || null) })
    return () => { alive = false }
  }, [imgPath])
  return (
    <AnimatePresence>
      {meal && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: 'rgba(15,23,42,0.45)' }} onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.85, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <Icon3D src={MEAL_ICON[meal.key]} emoji={meal.emoji} className="w-6 h-6" />
              <h3 className="text-[15px] font-extrabold text-gray-900">{meal.label} 식단</h3>
              <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto w-7 h-7 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              {meal.done ? (
                <>
                  {meal.imagePath && (
                    <div className="bg-gray-50">
                      {imgUrl
                        ? <img src={imgUrl} alt="" className="w-full max-h-64 object-cover" />
                        : <div className="py-12 text-center text-gray-300 text-[12px]">사진 불러오는 중…</div>}
                    </div>
                  )}
                  <div className="p-4 space-y-1.5">
                    {meal.items?.length > 0 ? meal.items.map((it, i) => (
                      <div key={i} className="rounded-xl bg-gray-50 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-semibold text-gray-900 truncate min-w-0">{it.name}{it.maker ? <span className="font-normal text-gray-400"> · {it.maker}</span> : null}</p>
                          <span className="text-[12px] font-bold text-gray-700 tabular-nums flex-shrink-0">{it.kcal}kcal</span>
                        </div>
                        <div className="flex items-center gap-2.5 mt-1">
                          <span className="text-[10.5px] text-gray-400 tabular-nums">{it.amount}{it.unit || 'g'}</span>
                          {MEAL_MACROS.map((nu) => (
                            <span key={nu.key} className={`inline-flex items-center gap-1 text-[10.5px] font-semibold ${nu.text} tabular-nums`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${nu.dot}`} />{it[nu.key] ?? 0}<span className="text-gray-300 font-normal">g</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )) : <p className="text-[12px] text-gray-400 text-center py-4">담은 음식 정보가 없어요</p>}
                  </div>
                </>
              ) : (
                <div className="py-14 text-center">
                  <p className="text-[13px] text-gray-400 leading-relaxed">아직 이 끼니를 기록하지 않았어요.</p>
                </div>
              )}
            </div>
            {meal.done && (
              <div className="flex-shrink-0 border-t border-gray-100 p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium text-gray-400">{meal.label} 합계</p>
                    <p className="text-[24px] font-extrabold text-gray-900 leading-none mt-1 tabular-nums">{(meal.kcal || 0).toLocaleString()}<span className="text-[13px] text-gray-400 font-bold ml-1">kcal</span></p>
                  </div>
                  <div className="flex items-start gap-3 pb-1">
                    {MEAL_MACROS.map((nu) => (
                      <div key={nu.key} className="text-right">
                        <p className="text-[10px] font-medium text-gray-400 flex items-center gap-1 justify-end leading-none"><span className={`w-1.5 h-1.5 rounded-full ${nu.dot}`} />{nu.label}</p>
                        <p className={`text-[14px] font-bold ${nu.text} tabular-nums leading-none mt-1`}>{meal[nu.key] || 0}<span className="text-[10px] font-medium text-gray-400">g</span></p>
                      </div>
                    ))}
                  </div>
                </div>
                {meal.source === 'photo' && <p className="text-[10px] text-gray-400 mt-2">📷 AI 추정 · 참고용</p>}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// 오늘의 영양 평가 — 접힘(제목+▼) → 펼치면 값 등장 + 화면 스크롤
function NutritionReport({ today }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const rows = DAILY_VALUE.map((n) => {
    const val = today?.[n.key] || 0
    const pct = n.dv > 0 ? Math.round((val / n.dv) * 100) : 0
    return { ...n, val, pct, over: pct > 110 }
  })
  const overs = rows.filter((r) => r.over && r.key !== 'kcal')
  const summary = rows.every((r) => r.val === 0)
    ? '식단을 인증하면 1일 기준치 대비 영양 상태를 알려드려요.'
    : overs.length
      ? `${overs.map((r) => r.label).join('·')}이(가) 1일 기준치를 넘었어요. 다음 끼니에서 조절해보세요.`
      : '아직 1일 기준치 안이에요. 균형 있게 채워가고 있어요.'
  const toggle = () => setOpen((o) => {
    const next = !o
    if (next) setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 160)  // 펼치면 화면 같이 내려감
    return next
  })
  return (
    <div ref={ref} className="rounded-2xl bg-white border border-gray-100 shadow-soft overflow-hidden">
      <button type="button" onClick={toggle} className="w-full flex items-center justify-between px-4 py-3.5">
        <h3 className="text-[13px] font-bold text-gray-800">오늘의 영양 평가</h3>
        <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
          1일 기준치 대비
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }} className="inline-flex"><ChevronDown className="w-4 h-4" /></motion.span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div className="px-4 pb-4">
              <div className="space-y-2.5">
                {rows.map((n, i) => (
                  <motion.div key={n.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 + i * 0.06, duration: 0.3 }}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-[12px] font-semibold text-gray-700">{n.label}</span>
                      <span className="text-[11px] tabular-nums">
                        <b className={n.over ? 'text-rose-500' : 'text-gray-800'}>{n.val.toLocaleString()}{n.unit}</b>
                        <span className="text-gray-400"> / {n.dv.toLocaleString()}{n.unit} · {n.pct}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <motion.div className={`h-full rounded-full ${n.over ? 'bg-rose-400' : n.bar}`}
                        initial={{ width: 0 }} animate={{ width: `${Math.min(100, n.pct)}%` }}
                        transition={{ delay: 0.1 + i * 0.06, duration: 0.5, ease: 'easeOut' }} />
                    </div>
                  </motion.div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">{summary}</p>
              <p className="text-[10px] text-gray-300 mt-1">※ 1일 영양성분 기준치 기준 참고용이며, 의학적 진단이 아니에요.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// 식단 개요 커스터마이즈 박스 — 순서·숨김 편집 대상(메뉴는 내비라 숨김 불가).
export const DIET_BOX_ORDER = ['summary', 'meals', 'nutrition', 'todayMissions', 'recent', 'menu']
export const DIET_BOX_LABELS = {
  summary: '진행 현황 · 주간',
  meals: '끼니별 현황',
  nutrition: '오늘의 영양 평가',
  todayMissions: '오늘의 미션',
  recent: '최근 인증',
  menu: '메뉴',
}

export default function DietOverview({
  today = { kcal: 0, carb: 0, protein: 0, fat: 0 },
  goal = 1800,
  onGoalChange = () => {},
  week = [],
  meals = MEAL_DEFAULT,
  streak = null,
  menu = [],
  todayMissions = [],
  recentItems = [],
  onRecord = () => {},
  boxOrder = null,
  hiddenBoxes = [],
  onEditLayout = () => {},
  editable = false,
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [trendOpen, setTrendOpen] = useState(false)
  const [mealDetail, setMealDetail] = useState(null)   // 끼니 상세 팝업 대상
  const weekData = week.length === 7 ? week
    : ['월', '화', '수', '목', '금', '토', '일'].map((l, i) => ({ label: l, kcal: week[i]?.kcal || 0 }))

  // 박스 레지스트리 — 순서·숨김 커스터마이즈 대상(ProgramHome 과 동일 패턴)
  const BOXES = {
    summary: () => (
      <div className="grid grid-cols-2 gap-2.5 items-stretch">
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft h-full flex flex-col items-center">
          <p className="text-[12px] font-bold text-gray-700 self-start">오늘의 진행 현황</p>
          <div className="flex-1 flex flex-col items-center justify-center py-1">
            <DonutCompact today={today} goal={goal} onClick={() => setDetailOpen(true)} />
          </div>
          <GoalEditor goal={goal} onChange={onGoalChange} />
        </div>
        <div className="flex flex-col gap-2.5">
          <WeeklyStreak count={streak?.count || 0}
            days={streak?.days?.length ? streak.days : ['월', '화', '수', '목', '금', '토', '일'].map((l) => ({ label: l, done: false }))}
            icon={<Icon3D src={MEAL_STREAK_ICON} emoji="🌱" className="w-6 h-6" />} iconBg="bg-emerald-50" />
          <WeeklyTrendMini week={weekData} onOpen={() => setTrendOpen(true)} />
        </div>
      </div>
    ),
    meals: () => <MealStatus meals={meals} onMealClick={setMealDetail} />,
    nutrition: () => <NutritionReport today={today} />,
    // 오늘의 미션 (최대 3개 미리보기) — ProgramHome 과 동일
    todayMissions: () => !(todayMissions?.length) ? null : (
      <div>
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <p className="text-[13px] font-bold text-gray-700">오늘의 미션</p>
          <button type="button" onClick={onRecord} className="text-[11px] text-gray-400">전체 보기 ›</button>
        </div>
        <div className="space-y-2">
          {todayMissions.slice(0, 3).map((m) => (
            <div key={m.id} className="bg-white rounded-2xl shadow-soft border border-gray-100 p-3 flex items-center gap-3">
              {m.thumb ? <img src={m.thumb} alt="" className="w-11 h-11 rounded-xl object-contain bg-gray-50 flex-shrink-0" /> : <span className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-xl flex-shrink-0">📋</span>}
              <div className="flex-1 min-w-0"><p className="text-[13px] font-bold text-gray-800 truncate">{m.title}</p><p className="text-[10px] text-emerald-600 font-bold mt-0.5">+{m.pt}P</p></div>
              {m.done
                ? <span className="text-[11px] font-bold text-emerald-600 flex-shrink-0">✓ 완료</span>
                : <button type="button" onClick={onRecord} className="text-[11px] font-bold text-white bg-emerald-500 rounded px-3 py-1.5 flex-shrink-0">인증</button>}
            </div>
          ))}
        </div>
      </div>
    ),
    // 최근 인증 (최대 3개)
    recent: () => !(recentItems?.length) ? null : (
      <div>
        <p className="text-[13px] font-bold text-gray-700 mb-1.5 px-0.5">최근 인증 기록</p>
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 divide-y divide-gray-50">
          {recentItems.slice(0, 3).map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-base flex-shrink-0">✅</span>
              <div className="flex-1 min-w-0"><p className="text-[12px] font-bold text-gray-700 truncate">{r.title}</p><p className="text-[10px] text-gray-400">{r.time}</p></div>
              <span className="text-[11px] font-bold text-emerald-600 flex-shrink-0">+{r.point}P</span>
            </div>
          ))}
        </div>
      </div>
    ),
    menu: () => {
      if (!menu.length) return null
      const compact = menu.length >= 5   // 4개까진 리치 카드, 5개 이상은 컴팩트로 1줄 유지
      return (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${menu.length}, minmax(0, 1fr))` }}>
          {menu.map((c) => <NavCard key={c.title} {...c} compact={compact} />)}
        </div>
      )
    },
  }

  const savedOrder = (boxOrder && boxOrder.length ? boxOrder : DIET_BOX_ORDER).filter((k) => BOXES[k])
  DIET_BOX_ORDER.forEach((k) => { if (BOXES[k] && !savedOrder.includes(k)) savedOrder.push(k) })  // 신규 박스 뒤 append
  const hidden = new Set(hiddenBoxes)
  const orderedKeys = savedOrder.filter((k) => !hidden.has(k))

  return (
    <div className="space-y-2.5">
      {orderedKeys.map((k, i) => {
        const content = BOXES[k]()
        return content ? <Reveal key={k} index={Math.min(i, 5)}>{content}</Reveal> : null
      })}

      {/* [운영자] 개요 화면 편집 — 가장 아래·중앙·옅은 회색 */}
      {editable && (
        <div className="flex justify-center pt-1">
          <button type="button" onClick={onEditLayout}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-gray-100 text-gray-500 text-[13px] font-semibold hover:bg-gray-200 transition">
            ✏️ 개요 화면 편집
          </button>
        </div>
      )}

      <DonutDetailModal open={detailOpen} onClose={() => setDetailOpen(false)} today={today} goal={goal} />
      <WeeklyTrendModal open={trendOpen} onClose={() => setTrendOpen(false)} week={weekData} />
      <MealDetailModal meal={mealDetail} onClose={() => setMealDetail(null)} />
    </div>
  )
}
