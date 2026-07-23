import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, ChevronRight, ChevronDown, HelpCircle } from 'lucide-react'
import { formatKstDate } from '../../lib/queries'
import { getKstHour, formatHour12, TIME_BUCKETS, bucketOfHour } from '../../lib/formatters'
import ParticipationTrendChart from './ParticipationTrendChart'

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

  // 이번 주 참여(주간 도달): 최근 7일 동안 1회 이상 인증한 참여자 / 전체 참여자.
  //   "매일은 아니어도 이번 주에 살아있는 사람" 비율. 오늘 참여(일간)와 같은 분모라 짝지어 비교 가능.
  const recent7Dates = new Set()
  for (let i = 0; i < 7; i++) recent7Dates.add(getDaysAgo(i))
  const weeklyActiveUsers = new Set()
  for (const r of verifications) {
    if (recent7Dates.has(formatKstDate(new Date(r.submitted_at)))) weeklyActiveUsers.add(r.user_id)
  }
  const weeklyReach = participantsCount > 0 ? Math.round((weeklyActiveUsers.size / participantsCount) * 100) : 0

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
  // 시계열 (프로그램 시작일~오늘) — 참여율·인증건수 두 계열을 같은 날짜 범위로 구성.
  //   일자별 고유참여자 집합 + 인증건수를 1회 순회로 집계 후 날짜 순회(효율적). 최대 400일 가드.
  //   참여율=도넛 클릭 팝업 차트, 인증건수=통계 화면 인라인 차트(둘 다 인터랙티브).
  const dayUserMap = new Map()
  const dayVerifCount = new Map()
  for (const r of verifications) {
    const ds = formatKstDate(new Date(r.submitted_at))
    if (!dayUserMap.has(ds)) dayUserMap.set(ds, new Set())
    dayUserMap.get(ds).add(r.user_id)
    dayVerifCount.set(ds, (dayVerifCount.get(ds) || 0) + 1)
  }
  const rateOfDay = (ds) => {
    const s = dayUserMap.get(ds)
    return { date: ds, rate: participantsCount > 0 ? Math.round(((s?.size || 0) / participantsCount) * 100) : 0, count: s?.size || 0 }
  }
  const countOfDay = (ds) => ({ date: ds, count: dayVerifCount.get(ds) || 0 })
  const trendDates = []
  const todayStr = formatKstDate(new Date())
  const startStr = program?.start_date || null
  if (startStr && startStr <= todayStr) {
    let cur = new Date(`${startStr}T00:00:00+09:00`)
    const endTs = new Date(`${todayStr}T00:00:00+09:00`).getTime()
    let guard = 0
    while (cur.getTime() <= endTs && guard < 400) {
      trendDates.push(formatKstDate(cur))
      cur = new Date(cur.getTime() + DAY_MS)
      guard++
    }
  }
  if (trendDates.length === 0) {
    // 시작일 없음/미래 → 최근 14일 폴백
    for (let i = 13; i >= 0; i--) trendDates.push(getDaysAgo(i))
  }
  const participationTrend = trendDates.map(rateOfDay)
  const verificationTrend = trendDates.map(countOfDay)

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
  // 이번 주 신규 참여자 — 최근 7일 내 실제 가입(joinedAt). 활동 여부와 무관한 "합류".
  //   (예전엔 activeDays<=1(저활동)을 신규로 잘못 셌음 → 94% 프로그램에서 "11명 합류?" 오류)
  const weekAgoTs = Date.now() - 7 * DAY_MS
  const newComers = userStats.filter(u => u.joinedAt && new Date(u.joinedAt).getTime() >= weekAgoTs)
  const newComersCount = newComers.length

  // 자동 추천 메시지 — 따뜻한 톤 (본인 정체성 반영)
  const highlights = []
  if (newComersCount > 0) {
    highlights.push({
      kind: 'positive',
      emoji: '✨',
      text: `이번 주 신규 참여자 ${newComersCount}명이 합류했어요.`,
      action: { label: '신규 참여자 보기', to: 'users?filter=new' },
    })
  }
  if (streakers.length > 0) {
    const names = streakers.map(s => s.nickname).join(', ')
    highlights.push({
      kind: 'positive',
      emoji: '🔥',
      text: `${names} 님이 꾸준히 참여 중이에요. 응원 한마디 전해보시는 건 어떠세요?`,
      action: { label: '활발 참여자 보기', to: 'users?filter=active' },
    })
  }
  if (topMission) {
    highlights.push({
      kind: 'positive',
      emoji: '📈',
      text: `「${topMission.title}」 인증이 활발해요 (${topMission.count}건). 비슷한 미션을 추가하시면 효과적일 수 있어요.`,
      action: { label: '미션별 현황 보기', to: 'missions' },
    })
  }
  if (zeroMissions.length > 0) {
    const sample = zeroMissions.slice(0, 2).map(m => `「${m.title}」`).join(', ')
    highlights.push({
      kind: 'suggestion',
      emoji: '🌱',
      text: `${sample}${zeroMissions.length > 2 ? ` 외 ${zeroMissions.length - 2}건` : ''} 참여도가 낮습니다. 적절한 조치를 권고드립니다.`,
      action: { label: '미션별 현황 보기', to: 'missions' },
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
        action: { label: '미션별 현황 보기', to: 'missions' },
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
      action: { label: '휴면 참여자 보기', to: 'users?filter=dormant' },
    })
  }
  if (highlights.length === 0) {
    // 빈/신규 프로그램은 "잘 되고 있어요"가 아니라 시작 안내가 맞음. 상태별로 구분.
    const noMissions = totalMissionsCount === 0
    const noParticipants = participantsCount === 0
    const noActivity = verifications.length === 0
    if (noMissions && noParticipants) {
      highlights.push({
        kind: 'suggestion', emoji: '🌱',
        text: '이제 막 시작한 프로그램이에요. 미션을 추가하고 참여자를 초대하면 활동이 시작돼요.',
      })
    } else if (noMissions) {
      highlights.push({
        kind: 'suggestion', emoji: '📋',
        text: '아직 미션이 없어요. 미션을 추가하면 참여자들이 인증을 시작할 수 있어요.',
      })
    } else if (noParticipants) {
      highlights.push({
        kind: 'suggestion', emoji: '🙌',
        text: '아직 참여자가 없어요. 초대 코드나 공유로 참여자를 모아보세요.',
      })
    } else if (noActivity) {
      highlights.push({
        kind: 'suggestion', emoji: '⏳',
        text: '참여자들의 첫 인증을 기다리고 있어요. 공지나 응원으로 시작을 도와보세요.',
      })
    } else {
      highlights.push({
        kind: 'neutral', emoji: '🌿',
        text: '프로그램이 안정적으로 운영되고 있어요. 좋은 흐름을 유지해주세요.',
      })
    }
  }

  return {
    participationRate,
    diversity,
    weeklyReach,
    metrics: {
      todayActive,
      participants: participantsCount,
      activeMissions: activeMissionsCount,
      totalMissions: totalMissionsCount,
      weeklyActive: weeklyActiveUsers.size,
    },
    participationTrend,
    verificationTrend,
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
    <div className="space-y-5 mb-5 mt-1">
      <Reveal><WidgetHighlights insights={insights} onAction={(to) => navigate(`/programs/${programId}/stats/${to}`)} /></Reveal>
      <Reveal><WidgetMetrics insights={insights} /></Reveal>
      <Reveal><WidgetTrend insights={insights} /></Reveal>
      <Reveal><WidgetHourly insights={insights} /></Reveal>
      <Reveal><WidgetDistribution insights={insights} onSegmentClick={goToFilteredUsers} /></Reveal>
    </div>
  )
}

// 스크롤로 뷰포트에 들어올 때 각 카드 페이드업 (1회)
function Reveal({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

// ─── 위젯 1: 프로그램 상태 ───
//   오늘 참여(큰 박스 = 도넛 + 활동 참여자 수 + 어제 대비, 클릭 시 일자별 추세 팝업)
//   + 이번 주 참여·미션 활용(가로 바 2박스). 색: 오늘=emerald / 이번주=amber / 미션=sky.

// 오늘 참여 — 큰 도넛(라벨 내장)
function BigDonut({ pct, hex }) {
  const s = 108, sw = 11, r = (s - sw) / 2, c = 2 * Math.PI * r
  const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100)
  return (
    <svg viewBox={`0 0 ${s} ${s}`} width={s} height={s} className="flex-shrink-0">
      <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke="#eef0f0" strokeWidth={sw} />
      <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke={hex} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${s / 2} ${s / 2})`}
        style={{ transition: 'stroke-dashoffset .6s ease' }} />
      <text x={s / 2} y={s / 2 - 6} textAnchor="middle" dominantBaseline="central" fontSize="24" fontWeight="800" fill="#111827">{pct}%</text>
      <text x={s / 2} y={s / 2 + 15} textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="700" fill="#9ca3af">오늘 참여</text>
    </svg>
  )
}

// 이번 주 참여 / 미션 활용 — 가로 바 + 큰 % + 세부수치 + (?) 설명
function BarStat({ label, pct, hex, sub, tip, tipAlign = 'left' }) {
  const [tipOpen, setTipOpen] = useState(false)
  const p = Math.min(100, Math.max(0, pct))
  return (
    <div className="relative bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
      <div className="flex items-center gap-0.5 mb-3">
        <span className="text-[13px] font-bold text-gray-500">{label}</span>
        {tip && (
          <button type="button" aria-label={`${label} 설명`}
            onClick={() => setTipOpen(v => !v)}
            className="text-gray-300 hover:text-gray-500 leading-none">
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-baseline gap-1.5 mb-5">
        <span className="text-[30px] font-extrabold text-gray-900 leading-none">
          {pct}<span className="text-lg text-gray-400 font-bold">%</span>
        </span>
        {sub && <span className="text-[11px] text-gray-400 tabular-nums">{sub}</span>}
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${p}%`, background: hex, transition: 'width .6s ease' }} />
      </div>
      {tip && tipOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setTipOpen(false)} />
          <div className={`absolute bottom-full mb-1.5 z-20 w-44 rounded-lg bg-gray-900 text-white text-[11px] font-normal leading-snug px-2.5 py-2 shadow-lg whitespace-pre-line ${tipAlign === 'right' ? 'right-0' : 'left-0'}`}>
            {tip}
          </div>
        </>
      )}
    </div>
  )
}

function WidgetMetrics({ insights }) {
  const [showTrend, setShowTrend] = useState(false)
  const m = insights.metrics
  // 어제 대비 활동 참여자 증감 — participationTrend 끝=오늘, 그 앞=어제
  const pt = insights.participationTrend || []
  const yesterday = pt.length >= 2 ? pt[pt.length - 2].count : null
  const delta = yesterday != null ? m.todayActive - yesterday : null
  const deltaBadge = delta == null ? null
    : delta > 0 ? { cls: 'bg-emerald-50 text-emerald-700', text: `▲ 어제보다 +${delta}명` }
    : delta < 0 ? { cls: 'bg-orange-50 text-orange-600', text: `▼ 어제보다 ${delta}명` }
    : { cls: 'bg-gray-100 text-gray-500', text: '어제와 같아요' }
  return (
    <div>
      {/* 오늘 참여 — 큰 박스, 클릭 시 추세 팝업 */}
      <button type="button" onClick={() => setShowTrend(true)}
        className="w-full flex items-center gap-5 bg-white border border-gray-100 rounded-card-lg shadow-soft p-6 text-left transition hover:bg-gray-50/60 active:scale-[0.99]">
        <BigDonut pct={insights.participationRate} hex="#10b981" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-gray-500 mb-1">오늘 활동한 참여자</p>
          <p className="text-[26px] font-extrabold text-gray-900 leading-none">
            {m.todayActive}<span className="text-[15px] font-bold text-gray-300"> / {m.participants}명</span>
          </p>
          {deltaBadge && (
            <span className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-bold ${deltaBadge.cls}`}>
              {deltaBadge.text}
            </span>
          )}
          <span className="mt-1.5 flex items-center gap-0.5 text-[11px] text-gray-400">
            터치해서 일자별 추세 보기 <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </button>

      {/* 이번 주 참여 / 미션 활용 — 가로 바 2박스 */}
      <div className="grid grid-cols-2 gap-3.5 mt-4">
        <BarStat label="이번 주 참여" pct={insights.weeklyReach} hex="#f59e0b"
          sub={`${m.weeklyActive}/${m.participants}명`} tipAlign="left"
          tip={"최근 7일 동안 한 번이라도 인증한 참여자 비율이에요.\n매일은 아니어도 이번 주에 활동한 사람을 보여줘요."} />
        <BarStat label="미션 활용" pct={insights.diversity} hex="#0ea5e9"
          sub={`${m.activeMissions}/${m.totalMissions}개`} tipAlign="right"
          tip={"등록한 미션 중 인증이 한 번이라도 올라온 미션의 비율이에요.\n낮으면 아무도 안 쓰는 미션이 있다는 뜻이에요."} />
      </div>

      {showTrend && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-5"
          style={{ background: 'rgba(15,23,42,0.45)' }}
          onClick={() => setShowTrend(false)}
        >
          <div className="w-full max-w-[360px] rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-base">👥</span>
              <h3 className="text-[15px] font-bold text-gray-800">일자별 참여율 추세</h3>
            </div>
            <p className="text-[12px] text-gray-400 mb-3">그날 활동한 참여자 비율(%)이에요. (전체 {insights.metrics.participants}명 기준)</p>
            <ParticipationTrendChart data={insights.participationTrend || []} subField="count" subUnit="명" />
            <button
              type="button"
              onClick={() => setShowTrend(false)}
              className="mt-4 w-full h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 위젯 2: 일자별 인증 추세 (제목 카드 밖 · 터치 시 팝업, 접힘 땐 지표 숨김) ───
function WidgetTrend({ insights }) {
  const { verificationTrend, last7Count, trendDelta, trendDeltaPct } = insights
  const [open, setOpen] = useState(false)

  let TrendIcon = Minus
  let trendCls = 'text-gray-500'
  if (trendDelta > 0) { TrendIcon = TrendingUp; trendCls = 'text-emerald-600' }
  else if (trendDelta < 0) { TrendIcon = TrendingDown; trendCls = 'text-orange-600' }

  return (
    <>
      {/* 접힘: 제목 카드 안 + 비대화형 프리뷰 + 힌트 (지난주 대비·건수 숨김) → 터치 시 팝업 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full bg-white border border-gray-100 rounded-card-lg shadow-soft p-5 overflow-hidden text-left transition hover:bg-gray-50/60 active:scale-[0.99]"
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-base font-bold text-gray-900">일자별 인증 추세</h3>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-50 rounded-full px-2.5 py-1 flex-shrink-0">
            👆 터치해서 보기
          </span>
        </div>
        <ParticipationTrendChart data={verificationTrend || []} field="count" unit="건" maxCap={Infinity} height={140} interaction="none" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-5" style={{ background: 'rgba(15,23,42,0.45)' }} onClick={() => setOpen(false)}>
          <div className="w-full max-w-[360px] rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">📈</span>
              <h3 className="text-[15px] font-bold text-gray-800">일자별 인증 추세</h3>
            </div>
            <p className="text-[12px] text-gray-500 mb-3 flex items-center gap-1.5 flex-wrap">
              <span>이번 주 <b className="text-gray-700">{last7Count}건</b></span>
              <span className="text-gray-300">·</span>
              <span className="text-gray-400">지난주 대비</span>
              <span className={`inline-flex items-center gap-0.5 font-semibold ${trendCls}`}>
                <TrendIcon className="w-3.5 h-3.5" />
                {trendDelta >= 0 ? '+' : ''}{trendDelta}
                {trendDeltaPct !== null && ` (${trendDeltaPct >= 0 ? '+' : ''}${trendDeltaPct}%)`}
              </span>
            </p>
            <ParticipationTrendChart data={verificationTrend || []} field="count" unit="건" maxCap={Infinity} interaction="scrub" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ─── 위젯 2.5: 시간대 인증 패턴 (제목 카드 안 · 4구간 큰 막대) ─────────────
// 운영자가 「명상 시간 바꿔야겠다」 같은 미션 시간 조정 결정의 직접 근거.
function WidgetHourly({ insights }) {
  const { hourlyTotal, peakHour, bucketCounts } = insights
  const [selBucket, setSelBucket] = useState(null)

  if (hourlyTotal === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
        <h3 className="text-base font-bold text-gray-900 mb-2">시간대 인증 패턴</h3>
        <p className="text-xs text-gray-500">아직 인증 기록이 없어요</p>
      </div>
    )
  }

  const peakBucket = peakHour !== null ? bucketOfHour(peakHour) : null
  const topBucket = [...bucketCounts].sort((a, b) => b.count - a.count)[0]
  const maxPct = Math.max(...bucketCounts.map(b => b.pct), 1)
  const bucketHex = { dawn: '#818cf8', morning: '#fbbf24', afternoon: '#34d399', evening: '#fb7185' }
  const sel = selBucket ? bucketCounts.find(b => b.key === selBucket) : null

  return (
    <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-base font-bold text-gray-900">시간대 인증 패턴</h3>
      </div>
      {/* 헤더 문구 — 선택 시 그 구간 상세, 아니면 피크 안내 (도넛 중앙과 같은 언어) */}
      {sel ? (
        <p className="text-xs mb-5">
          <b className="font-bold" style={{ color: bucketHex[sel.key] }}>{sel.emoji} {sel.label}</b>
          <span className="text-gray-400"> · </span>
          <b className="text-gray-800">{sel.count}건</b>
          <span className="text-gray-500"> · 전체의 {sel.pct}%</span>
        </p>
      ) : peakHour !== null ? (
        <p className="text-xs text-gray-600 mb-5">
          <span className="font-semibold text-emerald-700">{formatHour12(peakHour)}</span>
          {peakBucket && <span className="text-gray-500"> ({peakBucket.emoji}{peakBucket.label})</span>}
          {' '}에 가장 활발해요.
        </p>
      ) : <div className="mb-5" />}

      {/* 4구간 큰 막대 — 누르면 선택(강조) + 나머지 흐려짐, % 라벨은 막대 위 */}
      <div className="flex items-end gap-3">
        {bucketCounts.map(b => {
          const isTop = b.key === topBucket?.key && b.count > 0
          const isSel = b.key === selBucket
          const dim = selBucket != null && !isSel
          const emphasize = isSel || (selBucket == null && isTop)
          const barH = b.count > 0 ? Math.max(14, (b.pct / maxPct) * 80) : 4
          const barOpacity = b.count === 0 ? 1 : dim ? 0.3 : (emphasize ? 1 : 0.7)
          return (
            <div
              key={b.key}
              onClick={() => b.count > 0 && setSelBucket(p => (p === b.key ? null : b.key))}
              className={`flex-1 flex flex-col items-center ${b.count > 0 ? 'cursor-pointer' : ''}`}
            >
              {/* 막대 영역 — % 라벨을 각 막대 top 바로 위에 붙임 */}
              <div className="w-full h-28 relative flex items-end">
                <div
                  className={`w-full rounded-t-lg transition-all ${b.count === 0 ? 'bg-gray-100' : b.color}`}
                  style={{ height: `${barH}%`, opacity: barOpacity }}
                />
                <span
                  className={`absolute left-0 right-0 text-center text-[15px] font-extrabold transition ${emphasize ? 'text-emerald-700' : 'text-gray-800'}`}
                  style={{ bottom: `calc(${barH}% + 3px)`, opacity: dim ? 0.4 : 1 }}
                >
                  {b.pct}%
                </span>
              </div>
              <span className={`mt-2 text-[11px] text-center leading-tight transition ${isSel ? 'text-gray-800 font-semibold' : dim ? 'text-gray-400' : 'text-gray-500'}`}>{b.emoji} {b.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 참여자 상태 도넛 — 채워진 세그먼트(개별 클릭). 선택 시 두꺼워지고 나머지는 흐려짐.
function StatusDonut({ segments, total, selectedKey, onSelect, size = 116 }) {
  const cx = size / 2, cy = size / 2
  const rOut = size / 2 - 4, rIn = rOut - 16
  const TAU = Math.PI * 2, GAP = 0.05
  const pt = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`
  const sector = (rI, rO, a0, a1) => {
    const large = (a1 - a0) > Math.PI ? 1 : 0
    return `M ${pt(rO, a0)} A ${rO} ${rO} 0 ${large} 1 ${pt(rO, a1)} L ${pt(rI, a1)} A ${rI} ${rI} 0 ${large} 0 ${pt(rI, a0)} Z`
  }
  const active = segments.filter(s => s.count > 0)
  let a = -Math.PI / 2
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="flex-shrink-0">
      <circle cx={cx} cy={cy} r={(rIn + rOut) / 2} fill="none" stroke="#eef0f0" strokeWidth={rOut - rIn} />
      {active.map(s => {
        const frac = s.count / total
        const full = frac >= 0.999
        const a0 = a + (full ? 0 : GAP / 2), a1 = a + frac * TAU - (full ? 0 : GAP / 2)
        a += frac * TAU
        const isSel = s.key === selectedKey
        const dim = selectedKey != null && !isSel
        const rI = isSel ? rIn - 2 : rIn, rO = isSel ? rOut + 3 : rOut
        const common = { onClick: () => onSelect(s.key), style: { cursor: 'pointer', opacity: dim ? 0.3 : 1, transition: 'opacity .2s ease' } }
        return full ? (
          <circle key={s.key} cx={cx} cy={cy} r={(rI + rO) / 2} fill="none" stroke={s.hex} strokeWidth={rO - rI} {...common} />
        ) : (
          <path key={s.key} d={sector(rI, rO, a0, a1)} fill={s.hex} {...common} />
        )
      })}
    </svg>
  )
}

// ─── 위젯 3: 참여자 상태 — 도넛 + 범례(클릭 시 해당 그룹 목록으로) ────
function WidgetDistribution({ insights, onSegmentClick }) {
  const { activeCount, normalCount, dormantCount, total } = insights.distribution
  const [tipKey, setTipKey] = useState(null)
  const [selKey, setSelKey] = useState(null)
  if (total === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
        <h3 className="text-base font-bold text-gray-900 mb-2">참여자 상태</h3>
        <p className="text-xs text-gray-500">아직 참여자가 없어요</p>
      </div>
    )
  }
  const pct = (n) => Math.round((n / total) * 100)
  const segments = [
    { key: 'active', name: '활발', count: activeCount, hex: '#10b981', tip: '최근 3일 안에 인증한 참여자예요.' },
    { key: 'normal', name: '보통', count: normalCount, hex: '#f59e0b', tip: '3~7일 사이에 인증한 참여자예요.' },
    { key: 'dormant', name: '휴면', count: dormantCount, hex: '#f87171', tip: '7일 넘게 인증이 없어요 — 응원이 필요해요.' },
  ]
  const toggleSel = (k) => setSelKey(p => (p === k ? null : k))
  const sel = selKey ? segments.find(s => s.key === selKey && s.count > 0) : null
  // 중앙 숫자 — 선택 시 그 조각 인원수, 아니면 총원. 자릿수 많으면 축소.
  const shownNum = sel ? sel.count : total
  const numCls = shownNum >= 10000 ? 'text-xs' : shownNum >= 1000 ? 'text-sm' : shownNum >= 100 ? 'text-base' : 'text-lg'
  return (
    <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-base font-bold text-gray-900">참여자 상태</h3>
        <span className="text-xs text-gray-400 ml-auto">총 {total}명</span>
      </div>
      <div className="flex items-center gap-5">
        {/* 도넛 (조각 클릭 → 선택). 중앙: 선택 시 인원수+이름, 아니면 총원 */}
        <div className="relative flex-shrink-0">
          <StatusDonut segments={segments} total={total} selectedKey={selKey} onSelect={toggleSel} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none leading-none">
            <span className={`${numCls} font-extrabold whitespace-nowrap`} style={{ color: sel ? sel.hex : '#111827' }}>
              {shownNum}<span className="text-[11px] font-bold text-gray-400 ml-0.5">명</span>
            </span>
            {sel && <span className="mt-1 text-[10px] font-semibold text-gray-500">{sel.name}</span>}
          </div>
        </div>
        {/* 범례 — 행 클릭 시 선택(하이라이트), 화살표는 명단으로 진입, 정의는 (?) 툴팁 */}
        <div className="flex-1 min-w-0 space-y-1">
          {segments.map(s => (
            <div
              key={s.key}
              onClick={() => s.count > 0 && toggleSel(s.key)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition ${
                s.count === 0 ? 'opacity-40' : `cursor-pointer ${selKey === s.key ? 'bg-gray-100' : 'hover:bg-gray-50'}`
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform ${selKey === s.key ? 'scale-125' : ''}`} style={{ background: s.hex }} />
              <span className="text-[13px] font-semibold text-gray-700 whitespace-nowrap">{s.name}</span>
              <span className="relative flex items-center">
                <button
                  type="button"
                  aria-label={`${s.name} 설명`}
                  onClick={(e) => { e.stopPropagation(); setTipKey(k => (k === s.key ? null : s.key)) }}
                  className="text-gray-300 hover:text-gray-500 leading-none"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
                {tipKey === s.key && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setTipKey(null) }} />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 rounded-lg bg-gray-900 text-white text-[11px] font-normal leading-snug px-3 py-2 shadow-lg whitespace-nowrap">
                      {s.tip}
                    </div>
                  </>
                )}
              </span>
              <span className="ml-auto text-base font-extrabold text-gray-900 tabular-nums">{pct(s.count)}%</span>
              {s.count > 0 && (
                <button
                  type="button"
                  aria-label={`${s.name} 명단 보기`}
                  onClick={(e) => { e.stopPropagation(); onSegmentClick?.(s.key) }}
                  className="flex-shrink-0 -mr-1 p-0.5 rounded hover:bg-gray-200/60 text-gray-300 hover:text-gray-500"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 위젯 4: 이번 주 하이라이트 — 개수 배지 + 2개 초과 시 접기 ──────────────
function WidgetHighlights({ insights, onAction }) {
  const [showAll, setShowAll] = useState(false)
  const items = insights.highlights || []
  const LIMIT = 2
  const visible = showAll ? items : items.slice(0, LIMIT)
  const moreCount = items.length - LIMIT
  return (
    <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">💡</span>
        <h3 className="text-base font-bold text-gray-900">이번 주 하이라이트</h3>
        <span className="ml-auto inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold tabular-nums">{items.length}</span>
      </div>
      <div className="space-y-2">
        {visible.map((h, i) => {
          const cls = `p-3 rounded-xl text-xs leading-relaxed ${
            h.kind === 'positive' ? 'bg-emerald-50/60'
            : h.kind === 'suggestion' ? 'bg-amber-50/60'
            : 'bg-gray-50'
          }`
          const content = (
            <div className="flex gap-2 items-center">
              <span className="flex-shrink-0 self-start text-sm">{h.emoji}</span>
              <p className="text-gray-700 flex-1">{h.text}</p>
              {h.action && <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            </div>
          )
          return h.action ? (
            <button
              key={i}
              type="button"
              onClick={() => onAction?.(h.action.to)}
              className={`${cls} w-full text-left cursor-pointer transition hover:brightness-95 active:brightness-90`}
            >
              {content}
            </button>
          ) : (
            <div key={i} className={cls}>{content}</div>
          )
        })}
      </div>
      {moreCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(v => !v)}
          className="mt-2.5 w-full flex items-center justify-center gap-1 text-[13px] font-bold text-gray-500 hover:text-gray-700 py-1 transition"
        >
          {showAll ? '접기' : `+${moreCount}개 더 보기`}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  )
}

export default ProgramInsightsSummary
