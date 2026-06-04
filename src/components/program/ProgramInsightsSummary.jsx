import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Activity, Sparkles, TrendingUp, TrendingDown, Minus, Lightbulb, ChevronRight, Clock } from 'lucide-react'
import { formatKstDate } from '../../lib/queries'
import { getKstHour, formatHour12, TIME_BUCKETS, bucketOfHour } from '../../lib/formatters'

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

// 시간대 헬퍼는 lib/formatters.js 로 이동 (Day 65 — 미션 페이지 공유)

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

  // ─── 시간대 패턴 (KST 0-23) ────────────────
  // 전체 누적 인증의 시간대 분포 — 운영자가 미션 시간을 조정할 때의 근거
  const hourly = new Array(24).fill(0)
  // 미션별 시간대 분포도 같이 — highlights 의 「미션 시간 편중」 추천에 사용
  const missionHourly = new Map() // mission_id → { title, hourly, total, peakHour, peakCount }
  for (const r of verifications) {
    const h = getKstHour(r.submitted_at)
    hourly[h]++
    const mid = r.mission_id
    if (!missionHourly.has(mid)) {
      missionHourly.set(mid, {
        mission_id: mid,
        title: r.missions?.title || '(삭제된 미션)',
        hourly: new Array(24).fill(0),
        total: 0,
      })
    }
    const bucket = missionHourly.get(mid)
    bucket.hourly[h]++
    bucket.total++
  }
  for (const m of missionHourly.values()) {
    let peakH = null, peakC = -1
    for (let h = 0; h < 24; h++) {
      if (m.hourly[h] > peakC) { peakC = m.hourly[h]; peakH = h }
    }
    m.peakHour = peakH
    m.peakCount = peakC
    m.peakConcentration = m.total > 0 ? peakC / m.total : 0
  }

  const hourlyTotal = hourly.reduce((s, n) => s + n, 0)
  let peakHour = null
  if (hourlyTotal > 0) {
    let maxCount = -1
    for (let h = 0; h < 24; h++) {
      if (hourly[h] > maxCount) { maxCount = hourly[h]; peakHour = h }
    }
  }
  // 시간대 4구간 묶음 — 운영자의 「시간대 조정」 판단 보조
  const bucketCounts = TIME_BUCKETS.map(b => {
    let count = 0
    for (let h = b.range[0]; h <= b.range[1]; h++) count += hourly[h]
    return { ...b, count, pct: hourlyTotal > 0 ? Math.round((count / hourlyTotal) * 100) : 0 }
  })

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
  // 활발: 최근 3일 인증 / 보통: 3-7일 / 휴면: 7일+ (인증 0건 = lastActiveAt null = 휴면)
  // userStats 가 이제 인증 0건도 포함하므로 inactiveZero 보정 불필요 (Day 65 수정).
  const dormancyThreshold3 = Date.now() - 3 * DAY_MS
  const dormancyThreshold7 = Date.now() - 7 * DAY_MS
  let activeCount = 0, normalCount = 0, dormantCount = 0
  for (const u of userStats) {
    const lastTs = u.lastActiveAt ? new Date(u.lastActiveAt).getTime() : 0
    if (lastTs >= dormancyThreshold3) activeCount++
    else if (lastTs >= dormancyThreshold7) normalCount++
    else dormantCount++
  }
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
  // 신규/낮은 활동 참여자 — activeDays 0~1 인 사람 (인증 0건 포함)
  const newComers = userStats.filter(u => (u.activeDays || 0) <= 1)
  const newComersCount = newComers.length

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
  // 시간대 편중 — 한 구간이 50% 이상 차지하면 운영 시점 조정 힌트
  if (hourlyTotal >= 10) {
    const topBucket = [...bucketCounts].sort((a, b) => b.count - a.count)[0]
    if (topBucket && topBucket.pct >= 50) {
      highlights.push({
        kind: 'suggestion',
        emoji: '⏰',
        text: `${topBucket.emoji} ${topBucket.label} 시간대 인증이 ${topBucket.pct}%로 가장 많아요. 미션 알림이나 새 미션 시간을 이 구간 직전으로 맞춰보세요.`,
      })
    }

    // 미션별 강한 시간대 편중 — 인증 5건+ 이고 peak 집중도 40%+ 인 미션 중 최상위
    //   본인 의도 「산책은 아침에, 명상은 저녁에」 같은 패턴 자동 인식
    const focusedMissions = [...missionHourly.values()]
      .filter(m => m.total >= 5 && m.peakConcentration >= 0.4)
      .sort((a, b) => b.peakConcentration - a.peakConcentration)
    if (focusedMissions.length > 0) {
      const m = focusedMissions[0]
      const peakBucket = bucketOfHour(m.peakHour)
      const pct = Math.round(m.peakConcentration * 100)
      highlights.push({
        kind: 'positive',
        emoji: '🎯',
        text: `「${m.title}」은 ${peakBucket.emoji} ${formatHour12(m.peakHour)} 즈음에 ${pct}% 인증이 몰려있어요. 같은 시간대를 활용하는 새 미션을 추가하시면 효과적일 수 있어요.`,
      })
    }

    // 묶음 안에서 미션 간 시간대 차이가 큰 경우 — 인기 미션은 활발한데 다른 미션은 시간대가 어긋남
    //   인증 0건 + 같은 묶음에 인기 미션이 있는 경우, 인기 시간대로 옮겨보기 추천
    for (const b of bundleStats) {
      if (b.missions.length < 2) continue
      const topInBundle = b.missions.find(mi => mi.count >= 5)
      const zeroInBundle = b.missions.find(mi => mi.count === 0)
      if (topInBundle && zeroInBundle) {
        const topHour = missionHourly.get(topInBundle.mission_id)
        if (topHour && topHour.peakConcentration >= 0.35) {
          const peakBucket = bucketOfHour(topHour.peakHour)
          highlights.push({
            kind: 'suggestion',
            emoji: '💡',
            text: `「${zeroInBundle.title}」은 아직 인증이 없는데, 같은 묶음의 「${topInBundle.title}」은 ${peakBucket.emoji} ${peakBucket.label}에 활발해요. 시간대를 ${peakBucket.label}로 옮겨보시면 어떠세요?`,
          })
          break  // 묶음당 하이라이트 1개로 제한 — 메시지 폭주 방지
        }
      }
    }
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
    hourly,
    hourlyTotal,
    peakHour,
    bucketCounts,
    highlights,
  }
}

function ProgramInsightsSummary({ stats, program }) {
  const { id: programId } = useParams()
  const navigate = useNavigate()
  const insights = useMemo(() => computeInsights(stats, program), [stats, program])
  if (!insights) return null

  // 위젯 3 (분포) 클릭 → 사용자 목록 페이지로 필터링 진입
  const goToFilteredUsers = (filter) => {
    navigate(`/programs/${programId}/stats/users?filter=${filter}`)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3 mb-4"
    >
      <WidgetMetrics insights={insights} />
      <WidgetTrend insights={insights} />
      <WidgetHourly insights={insights} />
      <WidgetDistribution insights={insights} onSegmentClick={goToFilteredUsers} />
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

// ─── 위젯 2.5: 시간대 패턴 — KST 0-23시 인증 분포 ─────────────
// 운영자가 「명상 시간 바꿔야겠다」 같은 미션 시간 조정 결정의 직접 근거.
// 4구간 (새벽·아침·낮·저녁/밤) 묶음으로 큰 그림도 제공.
function WidgetHourly({ insights }) {
  const { hourly, hourlyTotal, peakHour, bucketCounts } = insights

  if (hourlyTotal === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-gray-800">시간대 패턴</h3>
        </div>
        <p className="text-xs text-gray-500">아직 인증 기록이 없어요</p>
      </div>
    )
  }

  const maxCount = Math.max(...hourly)
  const peakBucket = peakHour !== null ? bucketOfHour(peakHour) : null
  const topBucket = [...bucketCounts].sort((a, b) => b.count - a.count)[0]

  return (
    <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-bold text-gray-800">시간대 패턴</h3>
        <span className="text-[11px] text-gray-400 ml-auto">누적 {hourlyTotal}건 · KST</span>
      </div>
      {peakHour !== null && (
        <p className="text-xs text-gray-600 mb-3">
          <span className="font-semibold text-emerald-700">{formatHour12(peakHour)}</span>
          {peakBucket && <span className="text-gray-500"> ({peakBucket.emoji}{peakBucket.label})</span>}
          {' '}에 인증이 가장 활발해요.
        </p>
      )}

      {/* 24개 막대 — peak 강조 색 */}
      <div className="flex items-end gap-[2px] h-14 mb-1">
        {hourly.map((count, h) => {
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
          const isPeak = h === peakHour && count > 0
          const bucket = bucketOfHour(h)
          return (
            <div
              key={h}
              className="flex-1 flex flex-col justify-end h-full"
              title={`${formatHour12(h)} · ${count}건`}
            >
              <div
                className={`w-full rounded-sm transition-all ${
                  count === 0
                    ? 'bg-gray-100'
                    : isPeak
                      ? 'bg-emerald-500'
                      : `${bucket.color} opacity-60`
                }`}
                style={{ height: count === 0 ? '4px' : `${Math.max(8, pct)}%` }}
              />
            </div>
          )
        })}
      </div>
      {/* 시간 ticks — 0/6/12/18/24 */}
      <div className="relative h-3 text-[10px] text-gray-400 mb-3">
        <span className="absolute left-0">0</span>
        <span className="absolute left-1/4 -translate-x-1/2">6</span>
        <span className="absolute left-1/2 -translate-x-1/2">12</span>
        <span className="absolute left-3/4 -translate-x-1/2">18</span>
        <span className="absolute right-0">24</span>
      </div>

      {/* 4구간 분포 — 시간대 비중 */}
      <div className="grid grid-cols-4 gap-1.5">
        {bucketCounts.map(b => {
          const isTop = b.key === topBucket?.key && b.count > 0
          return (
            <div
              key={b.key}
              className={`text-center p-2 rounded-lg ${isTop ? 'bg-emerald-50' : 'bg-gray-50'}`}
            >
              <p className="text-[11px] text-gray-600 mb-0.5">{b.emoji} {b.label}</p>
              <p className={`text-sm font-bold ${isTop ? 'text-emerald-700' : 'text-gray-700'}`}>
                {b.pct}%
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 위젯 3: 참여자 상태 분포 — 범례 클릭 시 해당 그룹 사용자 목록으로 진입 ────
function WidgetDistribution({ insights, onSegmentClick }) {
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
    { key: 'active', label: '활발 (3일 내)', count: activeCount, color: 'bg-emerald-500', hover: 'hover:bg-emerald-50', emoji: '🟢' },
    { key: 'normal', label: '보통 (3-7일)', count: normalCount, color: 'bg-amber-400', hover: 'hover:bg-amber-50', emoji: '🟡' },
    { key: 'dormant', label: '휴면 (7일+)', count: dormantCount, color: 'bg-red-400', hover: 'hover:bg-red-50', emoji: '🔴' },
  ]
  return (
    <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-bold text-gray-800">참여자 상태</h3>
        <span className="text-xs text-gray-400 ml-auto">총 {total}명</span>
      </div>
      {/* 가로 스택 바 — 각 segment 클릭 가능 */}
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 mb-3">
        {segments.map((s, i) => s.count > 0 && (
          <button
            key={i}
            type="button"
            onClick={() => onSegmentClick?.(s.key)}
            className={`${s.color} cursor-pointer transition hover:brightness-110`}
            style={{ width: `${(s.count / total) * 100}%` }}
            title={`${s.label}: ${s.count}명 — 클릭해서 보기`}
            aria-label={`${s.label} ${s.count}명 보기`}
          />
        ))}
      </div>
      {/* 범례 — 행 전체 클릭 가능 */}
      <div className="space-y-0.5">
        {segments.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSegmentClick?.(s.key)}
            disabled={s.count === 0}
            className={`w-full flex items-center justify-between text-xs px-2 py-1.5 rounded-lg transition text-left ${
              s.count === 0 ? 'opacity-50 cursor-default' : `cursor-pointer ${s.hover}`
            }`}
          >
            <span className="flex items-center gap-1.5 text-gray-600">
              <span>{s.emoji}</span>
              <span>{s.label}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-gray-800 font-semibold">
                {s.count}명 <span className="text-gray-400 font-normal">({pct(s.count)}%)</span>
              </span>
              {s.count > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
            </span>
          </button>
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
