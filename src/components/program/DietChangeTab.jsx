import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Pencil } from 'lucide-react'
import { Icon3D } from './ProgramHome'
import { Reveal, useBarGrow, barGrowStyle } from './statsAnim'

// 「내 변화 · 식단」 탭 — 체중/허리둘레 곡선, 목표 달성 히트맵, 장기 영양 추이.
//   체중은 미션이 아니라 이 탭 안의 로거로만 입력(운영자 비노출·본인만).
//   props.data = { weight:[{date,weight,waist,mood?,memo?}], adherence:[{date,level}], nutrition:{week,month}, goalWeight, goalKcal, startWeight }

// 섹션 3D 아이콘(에셋 준비 전엔 이모지 폴백)
const ICON = {
  weight: { src: '/illustrations/change/weight.png', emoji: '⚖️' },
  waist: { src: '/illustrations/change/waist.png', emoji: '📏' },
  calendar: { src: '/illustrations/change/calendar.png', emoji: '📅' },
  chart: { src: '/illustrations/change/chart.png', emoji: '📊' },
  mood: { src: '/illustrations/change/mood.png', emoji: '🙂' },
}
const MOOD_EMOJI = { 1: '😣', 2: '😟', 3: '😐', 4: '🙂', 5: '😄' }
const HEAT = ['#eef7f2', '#c7ecd6', '#86dca6', '#3cbd6e', '#129447'] // 0~4 농도(옅음→진한 초록)
const MACRO = { carb: { name: '탄수', hex: '#f6b73c' }, protein: { name: '단백', hex: '#60a5fa' }, fat: { name: '지방', hex: '#fb7185' } }
const WD = ['월', '화', '수', '목', '금', '토', '일']

// ── 유틸 ───────────────────────────────────────────
const kg = (v) => (v == null ? '–' : (Math.round(v * 10) / 10).toFixed(1))
const fmtMD = (d) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`
function niceTicks(min, max, step) {
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const out = []
  for (let v = hi; v >= lo - 1e-9; v -= step) out.push(Math.round(v * 10) / 10)
  return { ticks: out, lo, hi }
}

// ── 섹션 헤더 ──────────────────────────────────────
function Head({ icon, title, right }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <Icon3D src={icon.src} emoji={icon.emoji} className="w-10 h-10" />
      <h3 className="text-[15px] font-bold text-gray-800">{title}</h3>
      {right && <span className="text-[11px] text-gray-400 ml-auto">{right}</span>}
    </div>
  )
}

// ── 세그먼트 컨트롤 ────────────────────────────────
function Segment({ options, value, onChange, className = '' }) {
  return (
    <div className={`inline-flex gap-1 p-1 bg-gray-100 rounded-xl ${className}`}>
      {options.map(([k, label]) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={`h-8 px-3 rounded-lg text-[12px] font-semibold transition ${value === k ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500'}`}>{label}</button>
      ))}
    </div>
  )
}

// ── 요약 히어로 ────────────────────────────────────
function SummaryHero({ series, goalWeight, startWeight, onEditGoal }) {
  const gradient = { background: 'linear-gradient(115deg, #3ec48b 0%, #17a689 52%, #0c9082 100%)' }
  const last = series[series.length - 1]?.weight ?? null
  // 체중 기록이 아직 없음 → 온보딩 히어로
  if (last == null) {
    return (
      <div className="rounded-3xl p-6 text-white shadow-elevated" style={gradient}>
        <p className="text-[13px] opacity-85">현재 체중</p>
        <p className="text-[24px] font-extrabold mt-1 leading-tight">아직 기록이 없어요</p>
        <p className="text-[13px] opacity-90 mt-1.5 leading-snug break-keep">아래 <b>「오늘 기록하기」</b>로 첫 체중을 남기면 변화 곡선이 그려져요.</p>
      </div>
    )
  }
  const base = startWeight ?? last
  const fromStart = last - base
  const down = fromStart <= 0
  const hasGoal = goalWeight != null
  // 감량/증량 방향을 고려한 진행률 — 시작→목표 방향으로 얼마나 왔나
  const range = hasGoal ? (Math.abs(base - goalWeight) || 1) : 1
  const dir = hasGoal ? (Math.sign(goalWeight - base) || 1) : 1   // +1 증량, -1 감량
  const progressed = (last - base) * dir                          // 목표 방향으로 이동량(뒤로 가면 음수)
  const pct = Math.max(0, Math.min(100, Math.round((progressed / range) * 100)))
  const reached = hasGoal && progressed >= range - 1e-9
  const remain = Math.max(0, range - progressed)
  return (
    <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-elevated" style={gradient}>
      <p className="text-[13px] opacity-85">현재 체중</p>
      <div className="flex items-center gap-3 mt-1">
        <div className="flex items-end gap-1.5">
          <span className="text-[52px] font-extrabold leading-none tabular-nums tracking-tight">{kg(last)}</span>
          <span className="text-[18px] font-bold opacity-85 mb-1.5">kg</span>
        </div>
        {fromStart !== 0 && (
          <span className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[15px] font-bold border border-white/45 bg-white/10 backdrop-blur-sm">
            {down ? '▼' : '▲'} {kg(Math.abs(fromStart))}kg
          </span>
        )}
      </div>
      {/* 목표 진행 바 (목표체중 설정 시) */}
      {hasGoal ? (
        <div className="mt-5">
          <div className="flex justify-between text-[12px] opacity-90 mb-1.5">
            <span>시작 <b className="font-bold">{kg(base)}</b></span>
            <button type="button" onClick={onEditGoal} className="inline-flex items-center gap-1 active:opacity-70">목표 <b className="font-bold">{kg(goalWeight)}</b><Pencil className="w-3 h-3 opacity-75" /></button>
          </div>
          <div className="relative h-2 rounded-full bg-white/25">
            <motion.div className="absolute inset-y-0 left-0 rounded-full bg-white"
              initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md ring-2 ring-white/50"
              style={{ left: `calc(${pct}% - 7px)` }} />
          </div>
          <p className="text-center text-[12px] font-bold mt-2.5">
            {reached ? '목표 달성! 🎉' : <>{pct}% 달성 · 목표까지 {kg(remain)}kg</>}
          </p>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 text-[12px] opacity-90">
          <span>시작 <b className="font-bold">{kg(base)}</b></span>
          <button type="button" onClick={onEditGoal} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 border border-white/40 font-semibold active:opacity-70">목표 체중 설정 <Pencil className="w-3 h-3" /></button>
        </div>
      )}
    </div>
  )
}

// ── 체중/허리둘레 곡선 ─────────────────────────────
function BodyChart({ series, goalWeight, onOpenLogger }) {
  const [metric, setMetric] = useState('weight')
  const isW = metric === 'weight'
  const pts = series.map((d) => ({ date: d.date, v: isW ? d.weight : d.waist })).filter((p) => p.v != null)
  const color = isW ? '#10b981' : '#8b5cf6'
  const unit = isW ? 'kg' : 'cm'
  const goal = isW ? goalWeight : null

  const W = 340, H = 172, padL = 30, padR = 14, padT = 14, padB = 24
  const vals = pts.map((p) => p.v)
  const dLo = Math.min(...vals, goal ?? Infinity), dHi = Math.max(...vals, goal ?? -Infinity)
  const { ticks, lo, hi } = niceTicks(dLo - 2, dHi + 2, 2)
  const xOf = (i) => padL + (i * (W - padL - padR)) / Math.max(1, pts.length - 1)
  const yOf = (v) => padT + ((hi - v) / (hi - lo)) * (H - padT - padB)
  const linePts = pts.map((p, i) => `${xOf(i)},${yOf(p.v)}`).join(' ')
  const area = `${xOf(0)},${H - padB} ${linePts} ${xOf(pts.length - 1)},${H - padB}`
  const lastV = pts[pts.length - 1]?.v
  const delta = pts.length > 1 ? lastV - pts[0].v : 0
  const xStep = Math.max(1, Math.round((pts.length - 1) / 5))

  return (
    <div className="rounded-3xl p-5 bg-white border border-gray-100 shadow-soft">
      <div className="flex items-center gap-2.5 mb-3">
        <Icon3D src={(isW ? ICON.weight : ICON.waist).src} emoji={(isW ? ICON.weight : ICON.waist).emoji} className="w-10 h-10" />
        <h3 className="text-[15px] font-bold text-gray-800">내 몸 변화</h3>
        <Segment className="ml-auto" value={metric} onChange={setMetric}
          options={[['weight', '체중(kg)'], ['waist', '허리둘레(cm)']]} />
      </div>
      {pts.length === 1 && (
        <p className="text-right text-[11px] text-gray-400 -mt-1.5 mb-1">{fmtMD(pts[0].date)} 기록</p>
      )}
      {pts.length === 0 ? (
        <p className="text-[13px] text-gray-400 text-center py-10">기록하면 곡선이 그려져요.</p>
      ) : pts.length === 1 ? (
        <div className="flex flex-col items-center py-8">
          <div className="flex items-end gap-1">
            <span className="text-[32px] font-extrabold text-gray-800 tabular-nums leading-none">{kg(pts[0].v)}</span>
            <span className="text-[14px] font-bold text-gray-400 mb-0.5">{unit}</span>
          </div>
          <p className="text-[12px] text-gray-400 mt-3 text-center break-keep">다른 날 한 번 더 기록하면 곡선이 이어져요.<br />(같은 날 여러 번은 마지막 값으로 덮어써요)</p>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 190 }}>
          <defs>
            <linearGradient id={`bc-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* 격자선 + Y축 라벨 */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} y1={yOf(t)} x2={W - padR} y2={yOf(t)} stroke="#eef0f2" strokeWidth="1" strokeDasharray="3 3" />
              <text x={padL - 6} y={yOf(t) + 3} textAnchor="end" className="fill-gray-400" style={{ fontSize: 9 }}>{kg(t)}</text>
            </g>
          ))}
          {/* 목표선(초록 점선) */}
          {goal != null && <line x1={padL} y1={yOf(goal)} x2={W - padR} y2={yOf(goal)} stroke={color} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9" />}
          <polygon points={area} fill={`url(#bc-${metric})`} />
          <motion.polyline points={linePts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: 'easeInOut' }} />
          {pts.map((p, i) => {
            const isLast = i === pts.length - 1
            return <circle key={i} cx={xOf(i)} cy={yOf(p.v)} r={isLast ? 5 : 3}
              fill={isLast ? '#fff' : color} stroke={color} strokeWidth={isLast ? 3 : 1.5} />
          })}
          {/* 끝점 값 라벨 */}
          <text x={xOf(pts.length - 1) - 8} y={yOf(lastV) - 8} textAnchor="end" fill={color} style={{ fontSize: 15, fontWeight: 800 }}>{kg(lastV)}</text>
          {/* X축 날짜 */}
          {pts.map((p, i) => (i % xStep === 0 || i === pts.length - 1)
            ? <text key={i} x={xOf(i)} y={H - 6} textAnchor="middle" className="fill-gray-400" style={{ fontSize: 9 }}>{fmtMD(p.date)}</text>
            : null)}
        </svg>
      )}
      <p className="sr-only">{delta > 0 ? '증가' : '감소'} {kg(Math.abs(delta))}{unit}</p>
      <button type="button" onClick={onOpenLogger}
        className="mt-3 w-full h-14 rounded-2xl bg-emerald-50 text-emerald-700 text-[16px] font-bold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition">
        <Plus className="w-5 h-5" /> 오늘 기록하기
      </button>
    </div>
  )
}

// ── 목표 달성 히트맵 ───────────────────────────────
function Heatmap({ adherence }) {
  const cells = useMemo(() => adherence.slice().sort((a, b) => a.date.localeCompare(b.date)), [adherence])
  const doneDays = cells.filter((c) => c.level > 0).length
  const startDow = cells.length ? (new Date(cells[0].date + 'T00:00:00').getDay() + 6) % 7 : 0
  const grid = [...Array(startDow).fill(null), ...cells]
  const weeks = []
  for (let i = 0; i < grid.length; i += 7) weeks.push(grid.slice(i, i + 7))
  // 각 주 열의 대표 월(그 주 첫 유효 셀) → 월이 바뀌는 지점에 라벨
  const monthTags = weeks.map((wk) => { const c = wk.find(Boolean); return c ? +c.date.slice(5, 7) : null })

  return (
    <div className="rounded-3xl p-5 bg-white border border-gray-100 shadow-soft">
      <Head icon={ICON.calendar} title="목표 달성 캘린더" right={`${doneDays}일 기록`} />
      {cells.length === 0 ? (
        <p className="text-[13px] text-gray-400 text-center py-8">끼니를 기록하면 달력이 채워져요.</p>
      ) : (<>
      <div className="overflow-x-auto pb-1">
        {/* 월 라벨 */}
        <div className="flex pl-6">
          {monthTags.map((m, i) => (
            <div key={i} className="w-[16px] text-[10px] text-gray-400 font-medium">
              {m && (i === 0 || monthTags[i - 1] !== m) ? `${m}월` : ''}
            </div>
          ))}
        </div>
        <div className="flex gap-[3px] mt-1">
          {/* 요일 라벨 */}
          <div className="flex flex-col gap-[3px] pr-1">
            {WD.map((d) => <span key={d} className="h-[13px] text-[9px] leading-[13px] text-gray-300">{d}</span>)}
          </div>
          {weeks.map((wk, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }).map((_, di) => {
                const c = wk[di]
                return <div key={di} title={c ? `${fmtMD(c.date)} · ${['미기록', '기록', '양호', '좋음', '목표달성'][c.level]}` : ''}
                  className="w-[13px] h-[13px] rounded-[3px]" style={{ background: c ? HEAT[c.level] : 'transparent' }} />
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-[10.5px] text-gray-400">
        {HEAT.map((h, i) => <span key={i} className="w-[11px] h-[11px] rounded-[3px]" style={{ background: h }} />)}
        <span className="ml-1.5">색이 진할수록 목표에 근접</span>
      </div>
      </>)}
    </div>
  )
}

// ── 장기 칼로리·영양 추이 (주/월) ──────────────────
function NutritionTrend({ nutrition, goalKcal }) {
  const [range, setRange] = useState('week')
  const rows = nutrition[range] || []
  const grow = useBarGrow(rows.length, [range])
  const rawMax = Math.max(goalKcal, ...rows.map((r) => r.kcal))
  const max = Math.ceil((rawMax * 1.12) / 400) * 400
  const yTicks = []
  for (let v = max; v >= 0; v -= 400) yTicks.push(v)
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.kcal, 0) / rows.length) : 0
  const overGoal = avg > goalKcal
  const totC = rows.reduce((s, r) => s + (r.carb || 0), 0), totP = rows.reduce((s, r) => s + (r.protein || 0), 0), totF = rows.reduce((s, r) => s + (r.fat || 0), 0)
  const totMacro = totC + totP + totF || 1

  return (
    <div className="rounded-3xl p-5 bg-white border border-gray-100 shadow-soft">
      <div className="flex items-center gap-2.5 mb-3">
        <Icon3D src={ICON.chart.src} emoji={ICON.chart.emoji} className="w-10 h-10" />
        <h3 className="text-[15px] font-bold text-gray-800">장기 영양 추이</h3>
        <Segment className="ml-auto" value={range} onChange={setRange} options={[['week', '주별'], ['month', '월별']]} />
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px] text-gray-400 text-center py-8">끼니 기록이 쌓이면 추이가 보여요.</p>
      ) : (<>
      <p className="text-[11px] text-gray-400 mb-1.5">평균 칼로리 (kcal)</p>
      {/* Y축 + 막대 + 목표선 */}
      <div className="flex gap-1.5">
        <div className="flex flex-col justify-between h-32 text-[9px] text-gray-400 tabular-nums text-right w-8">
          {yTicks.map((t) => <span key={t} className="leading-none">{t.toLocaleString()}</span>)}
        </div>
        <div className="relative flex-1 h-32">
          {/* 격자선 */}
          {yTicks.map((t) => <div key={t} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: `${((max - t) / max) * 100}%` }} />)}
          {/* 목표선 */}
          <div className="absolute left-0 right-0 border-t border-dashed border-emerald-400 z-10" style={{ top: `${((max - goalKcal) / max) * 100}%` }}>
            <span className="absolute -top-4 right-0 text-[10px] font-semibold text-emerald-500">목표 {goalKcal.toLocaleString()}</span>
          </div>
          {/* 막대 */}
          <div className="absolute inset-0 flex items-end gap-2">
            {rows.map((r, i) => (
              <div key={i} className="flex-1 h-full flex items-end" title={`${r.label} · ${r.kcal}kcal`}>
                <div className="w-full rounded-t-md" style={{ ...barGrowStyle(grow, i), height: `${(r.kcal / max) * 100}%`, background: r.kcal > goalKcal ? '#f9a8a8' : '#9ce0b4' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* X 라벨 */}
      <div className="flex gap-2 pl-[38px] mt-1.5">
        {rows.map((r, i) => <span key={i} className="flex-1 text-center text-[9px] text-gray-400 leading-tight">{r.label}</span>)}
      </div>
      {/* 매크로 평균 비율 스택 */}
      <div className="mt-4">
        <div className="flex h-2.5 rounded-full overflow-hidden">
          {[['carb', totC], ['protein', totP], ['fat', totF]].map(([k, v]) => (
            <div key={k} style={{ width: `${(v / totMacro) * 100}%`, background: MACRO[k].hex }} />
          ))}
        </div>
        <div className="flex justify-center gap-4 mt-2.5">
          {Object.entries(MACRO).map(([k, m]) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-[12px] text-gray-500">
              <span className="w-2 h-2 rounded-full" style={{ background: m.hex }} />{m.name}
            </span>
          ))}
        </div>
      </div>
      <p className="text-[11.5px] text-gray-500 mt-3 leading-snug break-keep">
        {overGoal ? `최근 ${range === 'week' ? '주' : '월'} 평균이 목표보다 ${(avg - goalKcal).toLocaleString()}kcal 높아요. 저녁·간식을 살펴보면 좋아요.`
          : '목표 범위 안에서 잘 유지하고 있어요 🌿'}
      </p>
      </>)}
    </div>
  )
}

// ── Before / After (수치형) — 시작 vs 최근 ─────────
function BeforeAfter({ weight, nutrition }) {
  const wPts = weight.filter((d) => d.weight != null)
  const wk = nutrition.week || []
  const rows = []
  if (wPts.length >= 2) rows.push({ label: '체중', before: wPts[0].weight, after: wPts[wPts.length - 1].weight, fmt: (v) => kg(v), unit: 'kg' })
  if (wk.length >= 2) rows.push({ label: '일 평균 칼로리', before: wk[0].kcal, after: wk[wk.length - 1].kcal, fmt: (v) => Math.round(v).toLocaleString(), unit: 'kcal' })
  if (!rows.length) return null
  return (
    <div className="rounded-3xl p-5 bg-white border border-gray-100 shadow-soft">
      <Head icon={ICON.chart} title="시작 vs 최근" />
      <div className="space-y-2.5">
        {rows.map((r) => {
          const d = r.after - r.before
          const down = d <= 0
          return (
            <div key={r.label} className="rounded-2xl bg-gray-50 px-4 py-3">
              <p className="text-[12px] text-gray-500 mb-1.5">{r.label}</p>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-gray-400 tabular-nums">{r.fmt(r.before)}</span>
                <span className="text-gray-300">→</span>
                <span className="text-[18px] font-extrabold text-gray-800 tabular-nums">{r.fmt(r.after)}<span className="text-[11px] font-bold text-gray-400 ml-0.5">{r.unit}</span></span>
                <span className={`ml-auto inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[12px] font-bold ${down ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                  {down ? '▼' : '▲'} {r.fmt(Math.abs(d))}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 컨디션 흐름 ────────────────────────────────────
function MoodTrend({ weight }) {
  const pts = weight.filter((d) => d.mood).slice(-10)
  if (!pts.length) return null
  return (
    <div className="rounded-3xl p-5 bg-white border border-gray-100 shadow-soft">
      <Head icon={ICON.mood} title="컨디션 흐름" />
      <div className="flex items-end justify-between gap-1">
        {pts.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className="text-[22px] leading-none">{MOOD_EMOJI[d.mood]}</span>
            <span className="text-[9px] text-gray-400">{fmtMD(d.date)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 한 줄 회고 ─────────────────────────────────────
function Memos({ weight }) {
  const notes = weight.filter((d) => d.memo).slice(-8).reverse()
  if (!notes.length) return null
  return (
    <div className="rounded-3xl p-5 bg-white border border-gray-100 shadow-soft">
      <Head icon={ICON.calendar} title="한 줄 회고" />
      <ul className="space-y-2.5">
        {notes.map((n, i) => (
          <li key={i} className="border-l-2 border-emerald-200 pl-3 py-0.5">
            <div className="flex items-center gap-1.5">
              {n.mood ? <span className="text-[13px]">{MOOD_EMOJI[n.mood]}</span> : null}
              <span className="text-[11px] text-gray-400">{fmtMD(n.date)}</span>
            </div>
            <p className="text-[13px] text-gray-700 leading-snug break-keep mt-0.5">{n.memo}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── 목표 체중 설정(바텀시트) ───────────────────────
function GoalWeightSheet({ open, current, onClose, onSave }) {
  const [val, setVal] = useState(current != null ? String(current) : '')
  const [wasOpen, setWasOpen] = useState(open)
  // 열릴 때 현재 목표값으로 프리필 (effect 대신 렌더 중 prop 변화 감지 — React 권장)
  if (open !== wasOpen) { setWasOpen(open); if (open) setVal(current != null ? String(current) : '') }
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(15,23,42,0.45)' }}
          onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-md bg-white rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}>
            <div className="flex items-center mb-1">
              <h3 className="text-[16px] font-extrabold text-gray-900">목표 체중</h3>
              <button type="button" onClick={onClose} className="ml-auto w-8 h-8 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[12px] text-gray-400 mb-4">설정하면 히어로에 시작→목표 진행률이 표시돼요.</p>
            <label className="block mb-4">
              <span className="text-[12px] font-semibold text-gray-500">목표 체중 (kg)</span>
              <input type="number" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} placeholder="예: 66.0"
                className="mt-1 w-full h-12 rounded-xl border border-gray-200 px-3 text-[16px] focus:border-emerald-400 outline-none" />
            </label>
            <div className="flex gap-2">
              {current != null && (
                <button type="button" onClick={() => onSave(null)} className="h-12 px-4 rounded-xl bg-gray-100 text-gray-500 text-[14px] font-semibold">해제</button>
              )}
              <button type="button" onClick={() => onSave(val ? Number(val) : null)} disabled={!val}
                className="flex-1 h-12 rounded-xl bg-emerald-500 text-white text-[15px] font-bold disabled:opacity-40 active:scale-[0.98] transition">저장</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── 입력 로거(바텀시트) ────────────────────────────
function LoggerSheet({ open, onClose, onSave, last }) {
  const [weight, setWeight] = useState('')
  const [waist, setWaist] = useState('')
  const [mood, setMood] = useState(0)
  const [memo, setMemo] = useState('')
  const MOODS = [[1, '😣'], [2, '😟'], [3, '😐'], [4, '🙂'], [5, '😄']]
  const reset = () => { setWeight(''); setWaist(''); setMood(0); setMemo('') }
  const save = () => {
    onSave({ weight: weight ? +weight : null, waist: waist ? +waist : null, mood: mood || null, memo: memo.trim() || null })
    reset(); onClose()
  }
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(15,23,42,0.45)' }}
          onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-md bg-white rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}>
            <div className="flex items-center mb-4">
              <h3 className="text-[16px] font-extrabold text-gray-900">오늘 기록</h3>
              <button type="button" onClick={onClose} className="ml-auto w-8 h-8 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-[12px] font-semibold text-gray-500">체중 (kg)</span>
                <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={last?.weight ? kg(last.weight) : '예: 62.4'}
                  className="mt-1 w-full h-11 rounded-xl border border-gray-200 px-3 text-[15px] focus:border-emerald-400 outline-none" />
              </label>
              <label className="block">
                <span className="text-[12px] font-semibold text-gray-500">허리둘레 (cm)</span>
                <input type="number" inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} placeholder={last?.waist ? kg(last.waist) : '선택'}
                  className="mt-1 w-full h-11 rounded-xl border border-gray-200 px-3 text-[15px] focus:border-emerald-400 outline-none" />
              </label>
            </div>
            <div className="mb-3">
              <span className="text-[12px] font-semibold text-gray-500">오늘 컨디션</span>
              <div className="flex gap-2 mt-1">
                {MOODS.map(([v, e]) => (
                  <button key={v} type="button" onClick={() => setMood(mood === v ? 0 : v)}
                    className={`flex-1 h-11 rounded-xl text-[20px] transition ${mood === v ? 'bg-emerald-100 ring-2 ring-emerald-400' : 'bg-gray-50'}`}>{e}</button>
                ))}
              </div>
            </div>
            <label className="block mb-4">
              <span className="text-[12px] font-semibold text-gray-500">한 줄 회고 (선택)</span>
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} placeholder="오늘 식단·몸 상태 메모"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-[14px] resize-none focus:border-emerald-400 outline-none" />
            </label>
            <button type="button" onClick={save} disabled={!weight && !waist}
              className="w-full h-12 rounded-xl bg-emerald-500 text-white text-[15px] font-bold disabled:opacity-40 active:scale-[0.98] transition">저장</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── 메인 ───────────────────────────────────────────
export default function DietChangeTab({ data, onAddEntry, onSetGoalWeight }) {
  const { weight = [], adherence = [], nutrition = { week: [], month: [] }, goalWeight = null, goalKcal = 1800, startWeight } = data || {}
  const sorted = useMemo(() => weight.slice().sort((a, b) => a.date.localeCompare(b.date)), [weight])
  const start = startWeight ?? sorted[0]?.weight ?? goalWeight
  const [loggerOpen, setLoggerOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const last = sorted[sorted.length - 1]
  // 2차 섹션 표시 여부 — 데이터 있을 때만
  const wCount = sorted.filter((d) => d.weight != null).length
  const showBeforeAfter = wCount >= 2 || (nutrition.week || []).length >= 2
  const hasMood = sorted.some((d) => d.mood)
  const hasMemo = sorted.some((d) => d.memo)

  return (
    <div className="space-y-4">
      <Reveal index={0}><SummaryHero series={sorted} goalWeight={goalWeight} startWeight={start} onEditGoal={() => setGoalOpen(true)} /></Reveal>
      <Reveal index={1}><BodyChart series={sorted} goalWeight={goalWeight} onOpenLogger={() => setLoggerOpen(true)} /></Reveal>
      <Reveal index={2}><Heatmap adherence={adherence} /></Reveal>
      <Reveal index={3}><NutritionTrend nutrition={nutrition} goalKcal={goalKcal} /></Reveal>
      {showBeforeAfter && <Reveal index={4}><BeforeAfter weight={sorted} nutrition={nutrition} /></Reveal>}
      {hasMood && <Reveal index={5}><MoodTrend weight={sorted} /></Reveal>}
      {hasMemo && <Reveal index={6}><Memos weight={sorted} /></Reveal>}

      <LoggerSheet open={loggerOpen} onClose={() => setLoggerOpen(false)} last={last}
        onSave={(entry) => onAddEntry?.(entry)} />
      <GoalWeightSheet open={goalOpen} current={goalWeight} onClose={() => setGoalOpen(false)}
        onSave={(v) => { onSetGoalWeight?.(v); setGoalOpen(false) }} />
    </div>
  )
}
