import { useMemo, useState } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useNavigate, useParams } from 'react-router-dom'
import { TrendingUp, TrendingDown, Minus, ChevronRight, ChevronDown } from 'lucide-react'
import { formatKstDate } from '../../lib/queries'
import { getKstHour, formatHour12, TIME_BUCKETS, bucketOfHour } from '../../lib/formatters'
import ParticipationTrendChart from './ParticipationTrendChart'
import { Reveal, CountUp, useBarGrow, barGrowStyle, useCountUp, SPRING_EASE } from './statsAnim'

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
      chip: `신규 ${newComersCount}명 합류`,
      text: `이번 주 신규 참여자 ${newComersCount}명이 합류했어요.`,
      action: { label: '신규 참여자 보기', to: 'users?filter=new' },
    })
  }
  if (streakers.length > 0) {
    const names = streakers.map(s => s.nickname).join(', ')
    highlights.push({
      kind: 'positive',
      emoji: '🔥',
      chip: `꾸준한 참여자 ${streakers.length}명`,
      text: `${names} 님이 꾸준히 참여 중이에요. 응원 한마디 전해보시는 건 어떠세요?`,
      action: { label: '활발 참여자 보기', to: 'users?filter=active' },
    })
  }
  if (topMission) {
    highlights.push({
      kind: 'positive',
      emoji: '📈',
      chip: `${topMission.title} 활발`,
      text: `「${topMission.title}」 인증이 활발해요 (${topMission.count}건). 비슷한 미션을 추가하시면 효과적일 수 있어요.`,
      action: { label: '미션별 현황 보기', to: 'missions' },
    })
  }
  if (zeroMissions.length > 0) {
    const sample = zeroMissions.slice(0, 2).map(m => `「${m.title}」`).join(', ')
    highlights.push({
      kind: 'suggestion',
      emoji: '🌱',
      chip: `저조 미션 ${zeroMissions.length}개`,
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
        chip: `${topBucket.label} 편중`,
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
        chip: `피크 ${formatHour12(m.peakHour)}`,
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
            chip: `${zeroInBundle.title} 시간대 조정`,
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
      chip: `휴면 ${dormantCount}명 챙기기`,
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
        kind: 'suggestion', emoji: '🌱', chip: '시작 준비하기',
        text: '이제 막 시작한 프로그램이에요. 미션을 추가하고 참여자를 초대하면 활동이 시작돼요.',
      })
    } else if (noMissions) {
      highlights.push({
        kind: 'suggestion', emoji: '📋', chip: '미션 추가하기',
        text: '아직 미션이 없어요. 미션을 추가하면 참여자들이 인증을 시작할 수 있어요.',
      })
    } else if (noParticipants) {
      highlights.push({
        kind: 'suggestion', emoji: '🙌', chip: '참여자 모으기',
        text: '아직 참여자가 없어요. 초대 코드나 공유로 참여자를 모아보세요.',
      })
    } else if (noActivity) {
      highlights.push({
        kind: 'suggestion', emoji: '⏳', chip: '첫 인증 대기 중',
        text: '참여자들의 첫 인증을 기다리고 있어요. 공지나 응원으로 시작을 도와보세요.',
      })
    } else {
      highlights.push({
        kind: 'neutral', emoji: '🌿', chip: '안정 운영 중',
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
      <Reveal index={0}><WidgetHighlights insights={insights} onAction={(to) => navigate(`/programs/${programId}/stats/${to}`)} /></Reveal>
      <Reveal index={1}><WidgetMetrics insights={insights} /></Reveal>
      <Reveal index={2}><WidgetTrend insights={insights} /></Reveal>
      <Reveal index={3}><WidgetHourly insights={insights} /></Reveal>
      <Reveal index={4}><WidgetDistribution insights={insights} onSegmentClick={goToFilteredUsers} /></Reveal>
    </div>
  )
}

// ─── 위젯 1: 프로그램 상태 ───
//   오늘 참여(큰 박스 = 도넛 + 활동 참여자 수 + 어제 대비, 클릭 시 일자별 추세 팝업)
//   + 이번 주 참여·미션 활용(가로 바 2박스). 색: 오늘=emerald / 이번주=amber / 미션=sky.

// 오늘 참여 — 큰 도넛(라벨 내장). 뷰 진입 시 숫자 카운트업 + 링 그리기 동시 진행.
function BigDonut({ pct, hex }) {
  const [ref, n] = useCountUp(pct)
  const s = 108, sw = 11, r = (s - sw) / 2, c = 2 * Math.PI * r
  const off = c * (1 - Math.min(100, Math.max(0, n)) / 100)
  return (
    <svg ref={ref} viewBox={`0 0 ${s} ${s}`} width={s} height={s} className="flex-shrink-0">
      <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke="#eef0f0" strokeWidth={sw} />
      <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke={hex} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${s / 2} ${s / 2})`} />
      <text x={s / 2} y={s / 2 - 6} textAnchor="middle" dominantBaseline="central" fontSize="24" fontWeight="800" fill="#23282b">{Math.round(n)}%</text>
      <text x={s / 2} y={s / 2 + 15} textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="700" fill="#6a736d">오늘 참여</text>
    </svg>
  )
}

// 이번 주 참여 / 미션 활용 — 세로 스택용 박스(하드라인·단일 emerald 바). 세로 중앙 정렬로 오늘참여 박스와 높이 맞춤.
function BarStat({ label, pct, sub, tip, tipAlign = 'left' }) {
  const [tipOpen, setTipOpen] = useState(false)
  const [ref, n] = useCountUp(pct)   // 숫자 + 바 너비 동시 굴러오름
  const p = Math.min(100, Math.max(0, n))
  return (
    <div ref={ref} className="relative bg-white rounded-card-lg flex-1 flex flex-col justify-center"
      style={{ border: '1px solid #e6e9e6', padding: 14 }}>
      <div className="flex items-center gap-1">
        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#6a736d' }}>{label}</span>
        {tip && (
          <button type="button" aria-label={`${label} 설명`}
            onClick={() => setTipOpen(v => !v)}
            className="inline-flex items-center justify-center flex-shrink-0"
            style={{ width: 14, height: 14, borderRadius: '50%', background: '#eef1ee', color: '#4b544f', fontSize: 9, fontWeight: 700 }}>?</button>
        )}
      </div>
      <div className="flex items-baseline" style={{ marginTop: 12, lineHeight: 1 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: '#23282b' }}>
          {Math.round(n)}<span style={{ fontSize: 12, color: '#6a736d', fontWeight: 700 }}>%</span>
        </span>
        {sub && <span className="tabular-nums" style={{ fontSize: 11, color: '#6a736d', marginLeft: 6 }}>{sub}</span>}
      </div>
      <div style={{ height: 6, borderRadius: 999, background: '#e4e7e4', overflow: 'hidden', marginTop: 13 }}>
        <div style={{ height: '100%', borderRadius: 999, width: `${p}%`, background: '#12a26b' }} />
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
  useBodyScrollLock(showTrend)  // 추이 상세 오버레이 — iOS 배경 스크롤 방지
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
      {/* 오늘 참여(좌 · 클릭 시 추세 팝업) | 이번 주 참여·미션 활용(우 스택) */}
      <div className="flex items-stretch" style={{ gap: 11 }}>
        <button type="button" onClick={() => setShowTrend(true)}
          className="bg-white rounded-card-lg flex flex-col items-center text-center transition hover:bg-gray-50/60 active:scale-[0.99]"
          style={{ border: '1px solid #e6e9e6', padding: '16px 14px', flex: '1.05' }}>
          <BigDonut pct={insights.participationRate} hex="#12a26b" />
          <p style={{ fontSize: 23, fontWeight: 700, color: '#23282b', marginTop: 12 }}>
            <CountUp value={m.todayActive} /><span style={{ fontSize: 13, color: '#6a736d', fontWeight: 700 }}> / {m.participants}명</span>
          </p>
          {deltaBadge && (
            <span className={`inline-flex items-center ${deltaBadge.cls}`}
              style={{ marginTop: 10, fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}>
              {deltaBadge.text}
            </span>
          )}
        </button>

        <div className="flex flex-col" style={{ flex: 1, gap: 11 }}>
          <BarStat label="이번 주 참여" pct={insights.weeklyReach}
            sub={`${m.weeklyActive}/${m.participants}명`} tipAlign="right"
            tip={"최근 7일 동안 한 번이라도 인증한 참여자 비율이에요.\n매일은 아니어도 이번 주에 활동한 사람을 보여줘요."} />
          <BarStat label="미션 활용" pct={insights.diversity}
            sub={`${m.activeMissions}/${m.totalMissions}개`} tipAlign="right"
            tip={"등록한 미션 중 인증이 한 번이라도 올라온 미션의 비율이에요.\n낮으면 아무도 안 쓰는 미션이 있다는 뜻이에요."} />
        </div>
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
            <ParticipationTrendChart data={insights.participationTrend || []} subField="count" subUnit="명" interaction="tap" />
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
  useBodyScrollLock(open)  // 추이 상세 오버레이 — iOS 배경 스크롤 방지

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
            <ParticipationTrendChart data={verificationTrend || []} field="count" unit="건" maxCap={Infinity} interaction="tap" />
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
// 컴팩트(2열 좌측) — 막대 위 건수 + emerald 농도로 피크 강조(피크=진한 emerald, 활발=emerald, 비피크=그레이).
function WidgetHourly({ insights }) {
  const { hourlyTotal, bucketCounts } = insights
  const [barsRef, grown, rmH] = useBarGrow()
  const [selKey, setSelKey] = useState(null)

  if (hourlyTotal === 0) {
    return (
      <div className="bg-white rounded-card-lg" style={{ border: '1px solid #e6e9e6', padding: '18px 16px' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#23282b' }}>시간대</h3>
        <p style={{ fontSize: 12, color: '#6a736d', marginTop: 8 }}>아직 인증 기록이 없어요</p>
      </div>
    )
  }

  const maxCount = Math.max(...bucketCounts.map(b => b.count), 1)
  const topKey = [...bucketCounts].sort((a, b) => b.count - a.count)[0]?.key

  return (
    <div className="bg-white rounded-card-lg" style={{ border: '1px solid #e6e9e6', padding: '18px 16px' }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#23282b' }}>시간대</h3>
      <div ref={barsRef} className="flex items-end" style={{ gap: 14, marginTop: 18 }}>
        {bucketCounts.map((b, i) => {
          const ratio = b.count / maxCount
          const isMax = b.key === topKey && b.count > 0
          const strong = b.count > 0 && (isMax || ratio >= 0.65)
          const barColor = b.count === 0 ? '#e2e6e3' : isMax ? '#059669' : strong ? '#10b981' : '#e2e6e3'
          const numColor = b.count === 0 ? '#6a736d' : isMax ? '#059669' : strong ? '#10b981' : '#6a736d'
          const labColor = isMax ? '#23282b' : strong ? '#4b544f' : '#6a736d'
          const labWeight = isMax ? 700 : strong ? 600 : 400
          // 막대 높이는 고정 트랙(108px) 대비 비율 → 값이 클수록 확실히 높게
          const barH = b.count > 0 ? Math.max(10, ratio * 100) : 4
          const isSel = b.key === selKey
          return (
            <div key={b.key}
              onClick={() => b.count > 0 && setSelKey(p => (p === b.key ? null : b.key))}
              className={`flex-1 flex flex-col items-center ${b.count > 0 ? 'cursor-pointer' : ''}`}
              style={{ transformOrigin: 'bottom', transform: isSel ? 'scale(1.06)' : 'scale(1)', transition: `transform .3s ${SPRING_EASE}` }}>
              {/* 고정 높이 트랙 — 막대는 트랙 대비 %, 숫자는 각 막대 top 바로 위에 절대배치 */}
              <div className="w-full relative flex items-end" style={{ height: 108 }}>
                <div className="w-full" style={{ height: `${barH}%`, borderRadius: '9px 9px 0 0', background: barColor, ...barGrowStyle(grown, rmH, i) }} />
                <div className="absolute left-0 right-0 flex justify-center"
                  style={{ bottom: `calc(${barH}% + 5px)`, lineHeight: 1, opacity: grown ? 1 : 0, transition: rmH ? 'none' : `opacity .4s ease ${0.2 + i * 0.05}s` }}>
                  {/* 탭하면 % → 건수로 토글 */}
                  <span className="tabular-nums" style={{ fontSize: 15, fontWeight: 800, color: numColor, whiteSpace: 'nowrap' }}>
                    {isSel && b.count > 0 ? `${b.count}건` : `${b.pct}%`}
                  </span>
                </div>
              </div>
              <span style={{ marginTop: 9, fontSize: 12, lineHeight: 1.3, color: labColor, fontWeight: labWeight, whiteSpace: 'nowrap' }}>{b.label.split('/')[0]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 컴팩트 참여자 상태 도넛 — emerald 참여도 그라데이션(활발=emerald, 보통=연한 emerald, 휴면=그레이).
//   조각 클릭 시 해당 그룹 명단으로 진입. 중앙엔 전체 인원.
export function StatusDonut({ segments, total, selectedKey, onSelect, size = 72 }) {
  const C = 2 * Math.PI * 46          // viewBox 120 기준 도넛 둘레
  const GAP = 3                        // 조각 사이 간격(호 길이)
  const active = segments.filter(s => s.count > 0)
  let cum = 0
  const sel = selectedKey ? segments.find(s => s.key === selectedKey && s.count > 0) : null
  const centerNum = sel ? sel.count : total
  const numSize = centerNum >= 1000 ? 14 : centerNum >= 100 ? 18 : 20
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className="flex-shrink-0">
      <circle cx="60" cy="60" r="46" fill="none" stroke="#eef0ef" strokeWidth="15" />
      {active.map(s => {
        const raw = (s.count / total) * C
        const len = Math.max(0, raw - (active.length > 1 ? GAP : 0))
        const off = -cum
        cum += raw
        const isSel = s.key === selectedKey
        const dim = selectedKey != null && !isSel
        // 선택 시 그 조각만 도넛 중앙 기준으로 살짝 팝(스프링) + 나머지 흐림. (rotate 를 style 로 옮겨 scale 과 함께 적용)
        return (
          <circle key={s.key} cx="60" cy="60" r="46" fill="none" stroke={s.hex} strokeWidth="15"
            strokeDasharray={`${len} ${C}`} strokeDashoffset={off}
            onClick={() => onSelect?.(s.key)}
            style={{
              cursor: 'pointer',
              opacity: dim ? 0.35 : 1,
              transformBox: 'view-box',
              transformOrigin: 'center',
              transform: isSel ? 'rotate(-90deg) scale(1.08)' : 'rotate(-90deg)',
              transition: `transform .3s ${SPRING_EASE}, opacity .2s ease`,
            }} />
        )
      })}
      <text x="60" y="55" textAnchor="middle" dominantBaseline="central" fontSize={numSize} fontWeight="800" fill="#23282b">{centerNum}</text>
      <text x="60" y="72" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700" fill="#6a736d">{sel ? sel.name : '참여자'}</text>
    </svg>
  )
}

// ─── 위젯 3: 참여자 상태 — 도넛(좌) + 범례(우, 행 탭 → 해당 그룹 명단) ────
function WidgetDistribution({ insights, onSegmentClick }) {
  const { activeCount, normalCount, dormantCount, total } = insights.distribution
  const [tipOpen, setTipOpen] = useState(false)
  const [selKey, setSelKey] = useState(null)
  if (total === 0) {
    return (
      <div className="bg-white rounded-card-lg" style={{ border: '1px solid #e6e9e6', padding: '18px 16px' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#23282b' }}>참여자 상태</h3>
        <p style={{ fontSize: 12, color: '#6a736d', marginTop: 8 }}>아직 참여자가 없어요</p>
      </div>
    )
  }
  const pct = (n) => Math.round((n / total) * 100)
  const segments = [
    { key: 'active', name: '활발', count: activeCount, hex: '#10b981' },
    { key: 'normal', name: '보통', count: normalCount, hex: '#6ee7b7' },
    { key: 'dormant', name: '휴면', count: dormantCount, hex: '#c3cac5' },
  ]
  return (
    <div className="bg-white rounded-card-lg" style={{ border: '1px solid #e6e9e6', padding: '18px 16px' }}>
      <div className="flex items-center relative" style={{ gap: 6 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#23282b' }}>참여자 상태</h3>
        <button type="button" aria-label="참여자 상태 설명" onClick={() => setTipOpen(v => !v)}
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{ width: 15, height: 15, borderRadius: '50%', background: '#eef1ee', color: '#4b544f', fontSize: 9.5, fontWeight: 700 }}>?</button>
        {tipOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setTipOpen(false)} />
            <div className="absolute z-20 rounded-lg shadow-lg"
              style={{ bottom: '100%', left: 0, marginBottom: 6, width: 172, background: '#23282b', padding: '10px 11px' }}>
              {[
                { hex: '#10b981', name: '활발', desc: '최근 3일 이내 인증' },
                { hex: '#6ee7b7', name: '보통', desc: '3~7일 사이 인증' },
                { hex: '#c3cac5', name: '휴면', desc: '7일 이상 인증 없음' },
              ].map((d, i) => (
                <div key={d.name} className="flex items-center" style={{ gap: 7, marginTop: i === 0 ? 0 : 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.hex, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{d.name}</span>
                  <span style={{ fontSize: 11, color: '#cbd0cc' }}>{d.desc}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex items-center" style={{ gap: 20, marginTop: 16 }}>
        <StatusDonut segments={segments} total={total} selectedKey={selKey}
          onSelect={(k) => setSelKey(p => (p === k ? null : k))} size={122} />
        <div className="flex flex-col" style={{ marginLeft: 'auto' }}>
          {segments.map((s) => {
            const isSel = s.key === selKey
            const disabled = s.count === 0
            return (
              // 행 탭 → 선택(회색 박스로 체크 + 도넛 스프링 + %↔건수). 오른쪽 > 버튼 → 해당 그룹 명단 이동.
              <div
                key={s.key}
                onClick={() => !disabled && setSelKey(p => (p === s.key ? null : s.key))}
                className="flex items-center"
                style={{
                  gap: 8, padding: '8px 10px', borderRadius: 12, whiteSpace: 'nowrap',
                  background: isSel ? '#f1f3f2' : 'transparent', transition: 'background .2s ease',
                  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.hex, flexShrink: 0, transform: isSel ? 'scale(1.3)' : 'scale(1)', transition: `transform .3s ${SPRING_EASE}` }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#4b544f' }}>{s.name}</span>
                {/* 값: 선택 시 % → 건수(N명). 색은 대비 위해 항상 짙은 회색(색 구분은 점이 담당) */}
                <span className="tabular-nums" style={{ fontSize: 15, fontWeight: 800, color: '#23282b' }}>
                  {isSel ? `${s.count}명` : `${pct(s.count)}%`}
                </span>
                {!disabled && (
                  <button type="button" aria-label={`${s.name} 명단 보기`}
                    onClick={(e) => { e.stopPropagation(); onSegmentClick?.(s.key) }}
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ marginLeft: 2, padding: 2, borderRadius: 6, color: '#9aa39d' }}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── 위젯 4: 이번 주 하이라이트 — 개수 배지 + 2개 초과 시 접기 ──────────────
// 하이라이트 — 접힘=한 줄 요약(칩), 탭 시 전체 목록 펼침. 카드=하드라인, 칩=중립색, 항목=구분선 그룹화.
function WidgetHighlights({ insights, onAction }) {
  const [open, setOpen] = useState(false)
  const items = insights.highlights || []
  if (items.length === 0) return null
  const CHIPS = 2
  const chipItems = items.slice(0, CHIPS)
  const moreCount = Math.max(0, items.length - CHIPS)

  return (
    <div className="bg-white rounded-card-lg" style={{ border: '1px solid #e6e9e6' }}>
      {/* 접힘 한 줄 — 탭 시 펼침 */}
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center text-left" style={{ gap: 7, padding: '13px 14px' }}>
        <span className="flex-shrink-0" style={{ fontSize: 15 }}>💡</span>
        {open ? (
          <span className="flex-1" style={{ fontSize: 14, fontWeight: 700, color: '#23282b' }}>이번 주 하이라이트</span>
        ) : (
          <span className="flex-1 flex items-center min-w-0 overflow-hidden" style={{ gap: 6 }}>
            {chipItems.map((h, i) => (
              <span key={i} className="flex-shrink-0 whitespace-nowrap"
                style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 9px', borderRadius: 999, background: '#eef1ee', color: '#4b544f' }}>
                {h.chip || h.text}
              </span>
            ))}
          </span>
        )}
        <span className="flex-shrink-0 flex items-center" style={{ gap: 3, fontSize: 12, fontWeight: 700, color: '#6a736d' }}>
          {!open && moreCount > 0 && <span className="tabular-nums">+{moreCount}</span>}
          <ChevronDown className="w-3.5 h-3.5" style={{ transition: 'transform .25s', transform: open ? 'rotate(180deg)' : 'none' }} />
        </span>
      </button>

      {/* 펼침 — 전체 목록(grid-rows 0fr↔1fr 로 높이 전환) */}
      <div className="grid" style={{ gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .32s cubic-bezier(.2,.75,.25,1)' }}>
        <div className="overflow-hidden">
          <div style={{ padding: '2px 6px 8px' }}>
            {items.map((h, i) => {
              const rowStyle = {
                display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%',
                padding: '11px 8px', fontSize: 12.5, lineHeight: 1.5, textAlign: 'left',
                borderTop: i === 0 ? 'none' : '1px solid #e6e9e6',
              }
              const inner = (
                <>
                  <span className="flex-shrink-0" style={{ lineHeight: 1.5 }}>{h.emoji}</span>
                  <span className="flex-1" style={{ color: '#4b544f' }}>{h.text}</span>
                  {h.action && <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: '#6a736d' }} />}
                </>
              )
              return h.action ? (
                <button key={i} type="button" onClick={() => onAction?.(h.action.to)} style={rowStyle}>{inner}</button>
              ) : (
                <div key={i} style={rowStyle}>{inner}</div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProgramInsightsSummary
