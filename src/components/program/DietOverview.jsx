import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Pencil, Check, X } from 'lucide-react'
import { NavCard } from './ProgramHome'

// 식단 카테고리 개요 — 데모(/dev/diet-overview)에서 확정한 구성의 실제 컴포넌트.
//   진행현황(도넛, 탭하면 스프링 확대+수치) | [스트릭 / 주간추이] · 끼니별 현황 · 메뉴.
//   데이터는 props 로 주입(없으면 0/빈 상태 우아하게). 목표 kcal 은 참여자가 설정(onGoalChange).
//
// props:
//   today:   { kcal, carb, protein, fat }         — 오늘 섭취(식단 미션 인증 집계). 기본 0.
//   goal:    number                                — 참여자 목표 kcal (없으면 1800)
//   onGoalChange(next:number)                      — 목표 변경 저장 콜백
//   week:    [{ label, kcal }]                     — 최근 7일 칼로리(비면 빈 차트)
//   meals:   [{ key,label,emoji,kcal,done }]       — 끼니별 현황
//   streak:  { count, days:[{label,done,today}] }  — 주간 스트릭
//   streakIcon: 'leaf' | 'flame'
//   menu:    [{ iconSrc,iconEmoji,title,desc,actionLabel,onClick,newCount }]

const MEAL_DEFAULT = [
  { key: 'breakfast', label: '아침', emoji: '🌅', kcal: 0, done: false },
  { key: 'lunch', label: '점심', emoji: '☀️', kcal: 0, done: false },
  { key: 'dinner', label: '저녁', emoji: '🌙', kcal: 0, done: false },
  { key: 'snack', label: '간식', emoji: '🍪', kcal: 0, done: false },
]

// 1일 영양성분 기준치 (식품등의 표시기준) — 간단 영양평가용 참조값
const DAILY_VALUE = [
  { key: 'kcal', label: '에너지', unit: 'kcal', dv: 2000, bar: 'bg-gray-400' },
  { key: 'carb', label: '탄수화물', unit: 'g', dv: 324, bar: 'bg-amber-400' },
  { key: 'protein', label: '단백질', unit: 'g', dv: 55, bar: 'bg-sky-400' },
  { key: 'fat', label: '지방', unit: 'g', dv: 54, bar: 'bg-rose-400' },
]

// 오늘의 영양 평가 — 섭취량을 1일 기준치와 비교(진행률 + 과잉 경고). 참고용.
function NutritionReport({ today }) {
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
  return (
    <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-bold text-gray-800">오늘의 영양 평가</h3>
        <span className="text-[10px] text-gray-400">1일 기준치 대비</span>
      </div>
      <div className="space-y-2.5">
        {rows.map((n) => (
          <div key={n.key}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[12px] font-semibold text-gray-700">{n.label}</span>
              <span className="text-[11px] tabular-nums">
                <b className={n.over ? 'text-rose-500' : 'text-gray-800'}>{n.val.toLocaleString()}{n.unit}</b>
                <span className="text-gray-400"> / {n.dv.toLocaleString()}{n.unit} · {n.pct}%</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${n.over ? 'bg-rose-400' : n.bar}`} style={{ width: `${Math.min(100, n.pct)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">{summary}</p>
      <p className="text-[10px] text-gray-300 mt-1">※ 1일 영양성분 기준치 기준 참고용이며, 의학적 진단이 아니에요.</p>
    </div>
  )
}

// 매크로 라벨(탄단지 %·g) — 모듈 스코프(렌더 중 컴포넌트 정의 금지)
function MacroLabel({ label, pct, g, color, align }) {
  return (
    <div className={`flex flex-col ${align === 'right' ? 'items-end text-right' : 'items-start text-left'}`}>
      <span className="text-[11px] text-gray-500 font-medium">{label}</span>
      <span className={`text-[17px] font-extrabold leading-none mt-0.5 ${color}`}>{pct}%</span>
      <span className="text-[10px] text-gray-400 mt-0.5">{g}g</span>
    </div>
  )
}

// 도넛 + 둘레 라벨(탄단지 %·g) + 중앙 칼로리 — 확대 모달용
function DonutMacros({ today, goal }) {
  const tot = today.carb + today.protein + today.fat || 1
  const pc = Math.round((today.carb / tot) * 100)
  const pp = Math.round((today.protein / tot) * 100)
  const pf = Math.max(0, 100 - pc - pp)
  const c1 = (today.carb / tot) * 100
  const c2 = c1 + (today.protein / tot) * 100
  const bg = tot > 1
    ? `conic-gradient(#fbbf24 0 ${c1}%, #38bdf8 ${c1}% ${c2}%, #f43f5e ${c2}% 100%)`
    : '#eef2f0'
  return (
    <div className="flex items-center justify-between w-full px-1">
      <MacroLabel label="탄수화물" pct={pc} g={today.carb} color="text-amber-500" align="right" />
      <div className="relative rounded-full flex-shrink-0" style={{ width: 132, height: 132, background: bg }}>
        <div className="absolute rounded-full bg-white flex flex-col items-center justify-center" style={{ inset: 16 }}>
          <span className="text-[10px] text-gray-400 leading-none">오늘 섭취</span>
          <span className="text-[22px] font-extrabold text-gray-900 tabular-nums leading-none mt-1">{today.kcal.toLocaleString()}</span>
          <span className="text-[10px] text-gray-400 leading-none mt-0.5">kcal</span>
          <span className="text-[9px] text-gray-300 leading-none mt-1">/ {goal.toLocaleString()} kcal</span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <MacroLabel label="단백질" pct={pp} g={today.protein} color="text-sky-500" align="left" />
        <MacroLabel label="지방" pct={pf} g={today.fat} color="text-rose-500" align="left" />
      </div>
    </div>
  )
}

// 컴팩트 도넛 — 카드 기본(반폭). 탭하면 확대 모달.
function DonutCompact({ today, goal, onClick }) {
  const tot = today.carb + today.protein + today.fat || 1
  const c1 = (today.carb / tot) * 100
  const c2 = c1 + (today.protein / tot) * 100
  const bg = tot > 1
    ? `conic-gradient(#fbbf24 0 ${c1}%, #38bdf8 ${c1}% ${c2}%, #f43f5e ${c2}% 100%)`
    : '#eef2f0'
  return (
    <button type="button" onClick={onClick} className="relative rounded-full active:scale-95 transition" style={{ width: 116, height: 116, background: bg }} aria-label="영양 상세 보기">
      <div className="absolute rounded-full bg-white flex flex-col items-center justify-center" style={{ inset: 14 }}>
        <span className="text-[9px] text-gray-400 leading-none">오늘 섭취</span>
        <span className="text-[19px] font-extrabold text-gray-900 tabular-nums leading-none mt-0.5">{today.kcal.toLocaleString()}</span>
        <span className="text-[9px] text-gray-400 leading-none">kcal</span>
        <span className="text-[8px] text-gray-300 leading-none mt-0.5">/ {goal.toLocaleString()}</span>
      </div>
    </button>
  )
}

// 접시 확대 모달 — 종료 리포트처럼 스프링으로 커지며 탄단지 수치 등장
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

// 주간 스트릭 (아이콘 잎/불꽃)
function StreakCard({ streak, iconKind }) {
  const leaf = iconKind !== 'flame'
  const count = streak?.count || 0
  const days = streak?.days?.length ? streak.days : ['월', '화', '수', '목', '금', '토', '일'].map((l) => ({ label: l, done: false }))
  return (
    <div className="rounded-2xl p-3.5 bg-white border border-gray-100 shadow-soft h-full">
      <div className="flex items-start gap-2.5">
        <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-lg ${leaf ? 'bg-emerald-50' : 'bg-orange-50'}`}>{leaf ? '🌱' : '🔥'}</span>
        <div className="min-w-0 flex-1">
          <span className="text-[13px] font-bold text-gray-800 whitespace-nowrap">주간 스트릭</span>
          <p className="text-[10px] text-gray-500 mt-1.5 truncate">{count}일 연속 성공 중</p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        {days.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className={`w-[18px] h-[18px] rounded-full flex items-center justify-center ${d.done ? 'bg-emerald-500' : 'bg-gray-100'}`}>
              <Check className={`w-3 h-3 ${d.done ? 'text-white' : 'text-gray-300'}`} strokeWidth={3} />
            </span>
            <span className={`text-[10px] ${d.today ? 'text-emerald-600 font-bold' : 'text-gray-400'}`}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TrendBars({ data, max, big = false }) {
  return (
    <div className="flex items-end justify-between gap-1.5 h-full">
      {data.map((d, i) => {
        const last = i === data.length - 1
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
            {big && <span className={`text-[9px] tabular-nums ${last ? 'text-emerald-600 font-bold' : 'text-gray-400'}`}>{d.kcal ? d.kcal.toLocaleString() : ''}</span>}
            <div className="w-full rounded-t-md" style={{ height: `${max > 0 ? Math.max(4, (d.kcal / max) * 100) : 4}%`, background: last ? '#10b981' : '#a7f3d0' }} />
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

function WeeklyTrendModal({ open, onClose, week }) {
  if (!open) return null
  const vals = week.map((d) => d.kcal).filter((v) => v > 0)
  const max = Math.max(1, ...week.map((d) => d.kcal))
  const avg = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: 'rgba(15,23,42,0.45)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-bold text-gray-800">주간 칼로리 추이</h3>
          <button type="button" onClick={onClose} className="text-gray-300 hover:text-gray-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="h-44"><TrendBars data={week} max={max} big /></div>
        <div className="mt-4 flex justify-between text-[12px]">
          <span className="text-gray-400">평균 <b className="text-gray-700">{avg.toLocaleString()}</b>kcal</span>
          <span className="text-gray-400">최고 <b className="text-gray-700">{Math.max(0, ...week.map((d) => d.kcal)).toLocaleString()}</b>kcal</span>
        </div>
      </div>
    </div>
  )
}

function MealStatus({ meals }) {
  return (
    <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft">
      <h3 className="text-[13px] font-bold text-gray-800 mb-3">끼니별 현황</h3>
      <div className="grid grid-cols-4 gap-2">
        {meals.map((m) => (
          <div key={m.key} className={`rounded-xl py-2.5 flex flex-col items-center gap-1 border ${m.done ? 'border-emerald-100 bg-emerald-50/50' : 'border-gray-100 bg-gray-50'}`}>
            <span className="text-[16px] leading-none">{m.emoji}</span>
            <span className="text-[11px] font-semibold text-gray-600">{m.label}</span>
            {m.done
              ? <span className="text-[10px] font-bold text-emerald-600 tabular-nums">{m.kcal}kcal</span>
              : <span className="text-[10px] text-gray-300">미기록</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DietOverview({
  today = { kcal: 0, carb: 0, protein: 0, fat: 0 },
  goal = 1800,
  onGoalChange = () => {},
  week = [],
  meals = MEAL_DEFAULT,
  streak = null,
  streakIcon = 'leaf',
  menu = [],
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [trendOpen, setTrendOpen] = useState(false)
  const weekData = week.length === 7 ? week
    : ['월', '화', '수', '목', '금', '토', '일'].map((l, i) => ({ label: l, kcal: week[i]?.kcal || 0 }))

  return (
    <div className="space-y-2.5">
      {/* 한 줄: [진행현황] | [스트릭 / 주간추이] — items-stretch 로 높이 자동 일치 */}
      <div className="grid grid-cols-2 gap-2.5 items-stretch">
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft h-full flex flex-col items-center">
          <p className="text-[12px] font-bold text-gray-700 self-start">오늘의 진행 현황</p>
          <div className="flex-1 flex flex-col items-center justify-center">
            <DonutCompact today={today} goal={goal} onClick={() => setDetailOpen(true)} />
            <p className="text-[10px] text-gray-400 mt-2">탭하면 영양 상세</p>
          </div>
          <GoalEditor goal={goal} onChange={onGoalChange} />
        </div>
        <div className="flex flex-col gap-2.5">
          <StreakCard streak={streak} iconKind={streakIcon} />
          <WeeklyTrendMini week={weekData} onOpen={() => setTrendOpen(true)} />
        </div>
      </div>

      <MealStatus meals={meals} />

      <NutritionReport today={today} />

      {menu.length > 0 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${menu.length}, minmax(0, 1fr))` }}>
          {menu.map((c) => <NavCard key={c.title} {...c} />)}
        </div>
      )}

      <DonutDetailModal open={detailOpen} onClose={() => setDetailOpen(false)} today={today} goal={goal} />
      <WeeklyTrendModal open={trendOpen} onClose={() => setTrendOpen(false)} week={weekData} />
    </div>
  )
}
