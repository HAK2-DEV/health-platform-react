import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Activity, Sparkles, TrendingUp, TrendingDown, Minus, Lightbulb } from 'lucide-react'
import { formatKstDate } from '../../lib/queries'

// Day 65 — 운영자 인사이트 위젯 4종 (ProgramStatsPage 상단).
//   1) 3대 지표 (참여율/다양성/꾸준함) — 종합 점수 대신 각 bar 로 분리
//   2) 최근 7일 인증 추세 sparkline
//   3) 참여자 상태 분포 (활발/보통/휴면)
//   4) 이번 주 하이라이트 (자동 추천 — 따뜻한 톤)
// 본인 [[project-brand-identity-2026-06-04]] 정체성: 신뢰·전문성 + 따뜻한 동반자
// 추천 톤: "~해요" / "~권해드려요" / "~수 있어요" — 강요 X, 제안 O

// ─── 유틸 ─────────────────────────────────────
const DAY_MS = 86_400_000

function getDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return formatKstDate(d)
}

// rows: [{ user_id, mission_id, submitted_at, missions: {...} }]
function computeInsights(stats, program) {
  if (!stats) return null
  const verifications = stats._raw || []
  const participantsCount = stats.participantsCount || 0
  const userStats = stats.userStats || []
  const bundleStats = stats.bundleStats || []

  // ─── 3대 지표 ──────────────────────────────
  // 참여율: 오늘 활동 참여자 / 전체 ACTIVE 참여자
  const today = formatKstDate(new Date())
  const todayActive = new Set(
    verifications.filter(r => formatKstDate(new Date(r.submitted_at)) === today).map(r => r.user_id)
  ).size
  const participationRate = participantsCount > 0
    ? Math.round((todayActive / participantsCount) * 100)
    : 0

  // 다양성: 사용된 미션 종류 / 프로그램의 전체 미션 종류 (proxy: bundleStats 미션 수)
  const totalMissionsCount = bundleStats.reduce((s, b) => s + b.missions.length, 0)
  const activeMissionsCount = bundleStats.reduce(
    (s, b) => s + b.missions.filter(m => m.count > 0).length,
    0
  )
  const diversity = totalMissionsCount > 0
    ? Math.round((activeMissionsCount / totalMissionsCount) * 100)
    : 0

  // 꾸준함: 최근 7일 중 인증이 1건 이상 있는 날의 비율 (참여자 평균이 아니라 프로그램 전체 활동일)
  const recent7Dates = new Set()
  for (let i = 0; i < 7; i++) recent7Dates.add(getDaysAgo(i))
  const activeDays = new Set()
  for (const r of verifications) {
    const d = formatKstDate(new Date(r.submitted_at))
    if (recent7Dates.has(d)) activeDays.add(d)
  }
  const consistency = Math.round((activeDays.size / 7) * 100)

  // ─── 7일 시계열 ────────────────────────────
  const trend7 = []
  for (let i = 6; i >= 0; i--) {
    const d = getDaysAgo(i)
    const count = verifications.filter(r => formatKstDate(new Date(r.submitted_at)) === d).length
    trend7.push({ date: d, count })
  }
  // 지난주 동일 기간 vs 이번주 비교
  let last7Count = 0
  let prev7Count = 0
  for (const r of verifications) {
    const ts = new Date(r.submitted_at).getTime()
    const now = Date.now()
    if (ts > now - 7 * DAY_MS) last7Count++
    else if (ts > now - 14 * DAY_MS) prev7Count++
  }
  const trendDelta = last7Count - prev7Count
  const trendDeltaPct = prev7Count > 0 ? Math.round((trendDelta / prev7Count) * 100) : null

  // ─── 참여자 상태 분포 ──────────────────────
  // 활발: 최근 3일 인증 / 보통: 3-7일 / 휴면: 7일+
  const dormancyThreshold3 = Date.now() - 3 * DAY_MS
  const dormancyThreshold7 = Date.now() - 7 * DAY_MS
  let activeCount = 0, normalCount = 0, dormantCount = 0
  for (const u of userStats) {
    const lastTs = u.lastActiveAt ? new Date(u.lastActiveAt).getTime() : 0
    if (lastTs >= dormancyThreshold3) activeCount++
    else if (lastTs >= dormancyThreshold7) normalCount++
    else dormantCount++
  }
  // userStats 에 없는 ACTIVE 참여자 (인증 0건) 도 휴면으로
  const inactiveZero = Math.max(0, participantsCount - userStats.length)
  dormantCount += inactiveZero
  const totalParticipants = activeCount + normalCount + dormantCount

  // ─── 하이라이트 자동 추출 ──────────────────
  // 가장 인기 미션
  const allMissionsFlat = bundleStats.flatMap(b => b.missions)
  const topMission = allMissionsFlat
    .filter(m => m.count > 0)
    .sort((a, b) => b.count - a.count)[0]
  // 참여 0 미션 (저조)
  const zeroMissions = allMissionsFlat.filter(m => m.count === 0)
  // 연속 활동자 — userStats 의 activeDays 가 5+ 인 사람들
  const streakers = userStats.filter(u => (u.activeDays || 0) >= 5)
    .sort((a, b) => (b.activeDays || 0) - (a.activeDays || 0))
    .slice(0, 3)
  // 신규 참여자 (lastActiveAt 이 program 시작일 이후 + activeDays 작은 사람) — 정확한 가입일은 없으나 first activity 시점 proxy
  const newComers = userStats.filter(u => (u.activeDays || 0) === 1)
  const newComersCount = newComers.length + inactiveZero  // 인증 0건도 신규 추정

  // 자동 추천 메시지 — 따뜻한 톤 (본인 정체성 반영)
  const highlights = []
  if (newComersCount > 0) {
    highlights.push({
      kind: 'positive',
      emoji: '✨',
      text: `이번 주 신규 참여자 ${newComersCount}명이 합류했어요.`,
    })
  }
  if (streakers.length > 0) {
    const names = streakers.map(s => s.nickname).join(', ')
    highlights.push({
      kind: 'positive',
      emoji: '🔥',
      text: `${names} 님이 꾸준히 참여 중이에요. 응원 한마디 전해보시는 건 어떠세요?`,
    })
  }
  if (topMission) {
    highlights.push({
      kind: 'positive',
      emoji: '📈',
      text: `「${topMission.title}」 인증이 활발해요 (${topMission.count}건). 비슷한 미션을 추가하시면 효과적일 수 있어요.`,
    })
  }
  if (zeroMissions.length > 0) {
    const sample = zeroMissions.slice(0, 2).map(m => `「${m.title}」`).join(', ')
    highlights.push({
      kind: 'suggestion',
      emoji: '🌱',
      text: `${sample}${zeroMissions.length > 2 ? ` 외 ${zeroMissions.length - 2}건` : ''} 참여도가 낮습니다. 적절한 조치를 권고드립니다.`,
    })
  }
  if (dormantCount > 0 && totalParticipants > 0 && dormantCount / totalParticipants >= 0.3) {
    highlights.push({
      kind: 'suggestion',
      emoji: '💌',
      text: `휴면 참여자 ${dormantCount}명이 있어요. 응원 메시지나 새 미션 추가를 권해드려요.`,
    })
  }
  if (highlights.length === 0) {
    highlights.push({
      kind: 'neutral',
      emoji: '🌿',
      text: '프로그램이 안정적으로 운영되고 있어요. 좋은 흐름을 유지해주세요.',
    })
  }

  return {
    participationRate,
    diversity,
    consistency,
    trend7,
    last7Count,
    trendDelta,
    trendDeltaPct,
    distribution: { activeCount, normalCount, dormantCount, total: totalParticipants },
    highlights,
  }
}

function ProgramInsightsSummary({ stats, program }) {
  const insights = useMemo(() => computeInsights(stats, program), [stats, program])
  if (!insights) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3 mb-4"
    >
      <WidgetMetrics insights={insights} />
      <WidgetTrend insights={insights} />
      <WidgetDistribution insights={insights} />
      <WidgetHighlights insights={insights} />
    </motion.div>
  )
}

// ─── 위젯 1: 3대 지표 ─────────────────────────
function WidgetMetrics({ insights }) {
  return (
    <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-bold text-gray-800">프로그램 지표</h3>
        <span className="text-[11px] text-gray-400 ml-auto">프로그램 유형에 맞춰 해석해주세요</span>
      </div>
      <div className="space-y-2.5">
        <MetricBar label="오늘 참여율" value={insights.participationRate} color="emerald" />
        <MetricBar label="미션 다양성" value={insights.diversity} color="sky" />
        <MetricBar label="최근 7일 꾸준함" value={insights.consistency} color="amber" />
      </div>
    </div>
  )
}

function MetricBar({ label, value, color }) {
  const colorCls = {
    emerald: 'bg-emerald-500',
    sky: 'bg-sky-500',
    amber: 'bg-amber-500',
  }[color] || 'bg-gray-500'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-sm font-bold text-gray-800">{value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colorCls}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
}

// ─── 위젯 2: 7일 추세 ────────────────────────
function WidgetTrend({ insights }) {
  const { trend7, last7Count, trendDelta, trendDeltaPct } = insights
  const max = Math.max(1, ...trend7.map(d => d.count))
  const w = 280
  const h = 80
  const stepX = w / Math.max(1, trend7.length - 1)
  const points = trend7.map((d, i) => {
    const x = i * stepX
    const y = h - (d.count / max) * (h - 8) - 4
    return { x, y, count: d.count, date: d.date }
  })
  const polylinePts = points.map(p => `${p.x},${p.y}`).join(' ')
  const last = points[points.length - 1]

  // 추세 화살표
  let TrendIcon = Minus
  let trendCls = 'text-gray-500'
  if (trendDelta > 0) { TrendIcon = TrendingUp; trendCls = 'text-emerald-600' }
  else if (trendDelta < 0) { TrendIcon = TrendingDown; trendCls = 'text-orange-600' }

  return (
    <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-bold text-gray-800">최근 7일 인증 추세</h3>
        <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ml-auto ${trendCls}`}>
          <TrendIcon className="w-3.5 h-3.5" />
          {trendDelta >= 0 ? '+' : ''}{trendDelta}
          {trendDeltaPct !== null && ` (${trendDeltaPct >= 0 ? '+' : ''}${trendDeltaPct}%)`}
        </span>
      </div>
      <div className="flex items-end gap-3">
        <p className="text-2xl font-bold text-gray-800 leading-none">
          {last7Count}<span className="text-xs text-gray-500 font-medium ml-1">건/주</span>
        </p>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full mt-3" preserveAspectRatio="none" style={{ maxHeight: '80px' }}>
        {/* 영역 채우기 */}
        <polygon
          points={`0,${h} ${polylinePts} ${w},${h}`}
          fill="rgb(16 185 129 / 0.1)"
        />
        <polyline
          points={polylinePts}
          fill="none"
          stroke="rgb(16 185 129)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* 마지막 점 강조 */}
        <circle cx={last.x} cy={last.y} r="4" fill="rgb(16 185 129)" />
        <circle cx={last.x} cy={last.y} r="6" fill="rgb(16 185 129)" fillOpacity="0.3" />
      </svg>
      <div className="flex justify-between mt-1 text-[10px] text-gray-400">
        {trend7.map((d, i) => (
          <span key={i}>{(['일','월','화','수','목','금','토'])[new Date(d.date).getDay()]}</span>
        ))}
      </div>
    </div>
  )
}

// ─── 위젯 3: 참여자 상태 분포 ────────────────
function WidgetDistribution({ insights }) {
  const { activeCount, normalCount, dormantCount, total } = insights.distribution
  if (total === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-2">참여자 상태</h3>
        <p className="text-xs text-gray-500">아직 참여자가 없어요</p>
      </div>
    )
  }
  const pct = (n) => Math.round((n / total) * 100)
  const segments = [
    { label: '활발 (3일 내)', count: activeCount, color: 'bg-emerald-500', emoji: '🟢' },
    { label: '보통 (3-7일)', count: normalCount, color: 'bg-amber-400', emoji: '🟡' },
    { label: '휴면 (7일+)', count: dormantCount, color: 'bg-red-400', emoji: '🔴' },
  ]
  return (
    <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-bold text-gray-800">참여자 상태</h3>
        <span className="text-xs text-gray-400 ml-auto">총 {total}명</span>
      </div>
      {/* 가로 스택 바 */}
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 mb-3">
        {segments.map((s, i) => s.count > 0 && (
          <div
            key={i}
            className={s.color}
            style={{ width: `${(s.count / total) * 100}%` }}
            title={`${s.label}: ${s.count}명`}
          />
        ))}
      </div>
      {/* 범례 */}
      <div className="space-y-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-gray-600">
              <span>{s.emoji}</span>
              <span>{s.label}</span>
            </span>
            <span className="text-gray-800 font-semibold">
              {s.count}명 <span className="text-gray-400 font-normal">({pct(s.count)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 위젯 4: 이번 주 하이라이트 ──────────────
function WidgetHighlights({ insights }) {
  return (
    <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-bold text-gray-800">이번 주 하이라이트</h3>
      </div>
      <div className="space-y-2">
        {insights.highlights.map((h, i) => (
          <div
            key={i}
            className={`flex gap-2 p-2.5 rounded-xl text-xs leading-relaxed ${
              h.kind === 'positive' ? 'bg-emerald-50/60'
              : h.kind === 'suggestion' ? 'bg-amber-50/60'
              : 'bg-gray-50'
            }`}
          >
            <span className="flex-shrink-0">{h.emoji}</span>
            <p className="text-gray-700">{h.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProgramInsightsSummary
