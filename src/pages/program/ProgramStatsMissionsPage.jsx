import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronDown } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchProgram, fetchProgramStats } from '../../lib/queries'
import { getKstHour, formatHour12, bucketOfHour } from '../../lib/formatters'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'
import { Reveal, CountUp, useBarGrow, barGrowStyle } from '../../components/program/statsAnim'

// 인증 0건 미션 sparkline 자리에 표시할 메시지
const NO_DATA_HINT = '아직 인증 없음'

// 번들(묶음)별 색상 — 순위 뱃지·태그·막대·피크칩에 공통 적용해 어느 묶음인지 한눈에
const BUNDLE_PALETTE = [
  { badge: 'bg-emerald-500', tag: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-600', pill: 'border-emerald-200 text-emerald-700', hex: '#10b981' },
  { badge: 'bg-orange-400', tag: 'bg-orange-50 text-orange-600', text: 'text-orange-500', pill: 'border-orange-200 text-orange-600', hex: '#fb923c' },
  { badge: 'bg-sky-500', tag: 'bg-sky-50 text-sky-700', text: 'text-sky-600', pill: 'border-sky-200 text-sky-700', hex: '#0ea5e9' },
  { badge: 'bg-violet-500', tag: 'bg-violet-50 text-violet-700', text: 'text-violet-600', pill: 'border-violet-200 text-violet-700', hex: '#8b5cf6' },
  { badge: 'bg-rose-400', tag: 'bg-rose-50 text-rose-600', text: 'text-rose-500', pill: 'border-rose-200 text-rose-600', hex: '#fb7185' },
]

// 미션 단위 24시간 미니 막대 — 단색(번들색), 피크만 진하게. 누르면 시각·건수 툴팁.
function MiniHourBars({ hourly, peakHour, hex }) {
  const [active, setActive] = useState(null)
  const [barsRef, grown, rm] = useBarGrow()
  const max = Math.max(1, ...hourly)
  return (
    <div
      ref={barsRef}
      className="relative flex items-end gap-[1.5px] h-9 select-none"
      style={{ WebkitTouchCallout: 'none', touchAction: 'pan-y' }}
      aria-label="시간대 분포"
    >
      {active !== null && (
        <div
          className="absolute bottom-full z-20 -translate-x-1/2 mb-1 pointer-events-none"
          style={{ left: `${Math.min(88, Math.max(12, ((active + 0.5) / 24) * 100))}%` }}
        >
          <div className="relative rounded-md bg-gray-900 text-white text-[10px] font-bold px-2 py-1 whitespace-nowrap shadow-lg">
            {formatHour12(active)} · {hourly[active]}건
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      )}
      {hourly.map((count, h) => {
        const pct = (count / max) * 100
        const isPeak = h === peakHour && count > 0
        return (
          <div
            key={h}
            className="flex-1 flex flex-col justify-end h-full cursor-pointer"
            title={`${formatHour12(h)} · ${count}건`}
            onClick={() => setActive(cur => (cur === h ? null : h))}
          >
            <div
              className="w-full rounded-sm"
              style={{ height: count === 0 ? '3px' : `${Math.max(10, pct)}%`, background: count === 0 ? '#f3f4f6' : hex, opacity: count === 0 ? 1 : (active === h ? 1 : (isPeak ? 1 : 0.35)), ...barGrowStyle(grown, rm, h, 0.12, 0.012) }}
            />
          </div>
        )
      })}
    </div>
  )
}

// 시각 범위 라벨 — 예: (17,19) → "오후 5-7시", (11,13) → "오전 11시-오후 1시"
function formatHourRange(a, b) {
  const ampm = (h) => (h < 12 ? '오전' : '오후')
  const h12 = (h) => { const x = h % 12; return x === 0 ? 12 : x }
  if (a === b) return `${ampm(a)} ${h12(a)}시`
  if (ampm(a) === ampm(b)) return `${ampm(a)} ${h12(a)}-${h12(b)}시`
  return `${ampm(a)} ${h12(a)}시-${ampm(b)} ${h12(b)}시`
}

// 프로그램 전체 24시간 막대 — 피크 시간대(windowSet)만 진하게, 나머지는 흐리게. 누르면 시각·건수 툴팁.
function PeakHourChart({ hourly, windowSet }) {
  const [active, setActive] = useState(null)
  const [barsRef, grown, rm] = useBarGrow()
  const max = Math.max(1, ...hourly)
  return (
    <div>
      <div ref={barsRef} className="relative flex items-end gap-[3px] h-28 select-none" style={{ WebkitTouchCallout: 'none', touchAction: 'pan-y' }}>
        {active !== null && (
          <div
            className="absolute bottom-full z-20 -translate-x-1/2 mb-1 pointer-events-none"
            style={{ left: `${Math.min(90, Math.max(10, ((active + 0.5) / 24) * 100))}%` }}
          >
            <div className="relative rounded-md bg-gray-900 text-white text-[11px] font-bold px-2 py-1 whitespace-nowrap shadow-lg">
              {formatHour12(active)} · {hourly[active]}건
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          </div>
        )}
        {hourly.map((count, h) => {
          const pct = (count / max) * 100
          const inWin = windowSet.has(h)
          return (
            <div
              key={h}
              className="flex-1 flex flex-col justify-end h-full cursor-pointer"
              title={`${formatHour12(h)} · ${count}건`}
              onClick={() => setActive(cur => (cur === h ? null : h))}
            >
              <div
                className={`w-full rounded-t-md ${count === 0 ? 'bg-gray-100' : 'bg-emerald-500'}`}
                style={{ height: count === 0 ? '3px' : `${Math.max(6, pct)}%`, opacity: count === 0 ? 1 : (active === h ? 1 : (inWin ? 1 : 0.3)), ...barGrowStyle(grown, rm, h, 0.15, 0.012) }}
              />
            </div>
          )
        })}
      </div>
      <div className="relative h-4 mt-1.5 text-[11px] text-gray-400">
        <span className="absolute left-0">0시</span>
        <span className="absolute left-1/4 -translate-x-1/2">6시</span>
        <span className="absolute left-1/2 -translate-x-1/2">12시</span>
        <span className="absolute left-3/4 -translate-x-1/2">18시</span>
        <span className="absolute right-0">24시</span>
      </div>
    </div>
  )
}

// 운영자 — 미션별 인증 현황 디테일 (묶음 그루핑 + 세부 미션)
// 라우트: /programs/:id/stats/missions
function ProgramStatsMissionsPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const userId = session?.user?.id

  const { data: program, isLoading: isProgramLoading } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })

  const isOwner = program?.owner_id === userId

  // 펼친 미션(누가 인증했는지 보기) — mission_id, 한 번에 하나만.
  //   세부(참여자 인증 게시물)로 들어갔다 뒤로 와도 유지되도록 sessionStorage 에 저장/복원.
  const OPEN_KEY = `stats-missions-open-${id}`
  const [openMission, setOpenMission] = useState(() => {
    try { return sessionStorage.getItem(OPEN_KEY) || null } catch { return null }
  })
  const toggleMission = (mid) => {
    setOpenMission((cur) => {
      const next = cur === mid ? null : mid
      try { next ? sessionStorage.setItem(OPEN_KEY, next) : sessionStorage.removeItem(OPEN_KEY) } catch { /* sessionStorage 미지원 */ }
      return next
    })
  }

  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: queryKeys.programStats(id),
    queryFn: () => fetchProgramStats(id),
    enabled: !!session && !!id && isOwner,
  })

  if (isProgramLoading) {
    return <LoadingState variant="page" />
  }
  if (!program) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="p-4 bg-red-100 text-red-700 rounded">프로그램을 찾을 수 없습니다</p>
        <Link to="/dashboard" className="block mt-4 text-emerald-600 hover:underline">← 대시보드로</Link>
      </div>
    )
  }
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(`/programs/${id}`)}
          className="flex items-center justify-center w-9 h-9 -ml-1 mb-2 rounded-full hover:bg-gray-100 transition"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">
          운영자만 통계를 볼 수 있어요
        </p>
      </div>
    )
  }

  // 막대 = "전체 인증 대비 비중(%)" — 완주율 오해 방지. 옆에 수치도 명시.
  const grandTotal = stats?.bundleStats?.reduce((s, b) => s + b.totalCount, 0) || 0

  // 프로그램 전체(미션 통틀어) 시간대 분포 + 피크 시간대(피크±1h, 3시간 밴드)
  const programHourly = (() => {
    const arr = new Array(24).fill(0)
    for (const v of stats?._raw || []) arr[getKstHour(v.submitted_at)]++
    return arr
  })()
  let peakHour = null, peakCount = -1
  for (let h = 0; h < 24; h++) if (programHourly[h] > peakCount) { peakCount = programHourly[h]; peakHour = h }
  const hasHourData = grandTotal > 0 && peakHour != null && peakCount > 0
  const winStart = hasHourData ? Math.max(0, peakHour - 1) : 0
  const winEnd = hasHourData ? Math.min(23, peakHour + 1) : 0
  const windowSet = new Set()
  for (let h = winStart; h <= winEnd; h++) windowSet.add(h)
  let windowCount = 0
  for (let h = winStart; h <= winEnd; h++) windowCount += programHourly[h]
  const windowPct = grandTotal > 0 ? Math.round((windowCount / grandTotal) * 100) : 0
  const rangeLabel = hasHourData ? formatHourRange(winStart, winEnd) : null

  // 미션별 시간대 분포 — _raw 한 번 순회해서 모든 미션의 24시간 카운트 + peak 시간 산출
  // 본인 「산책 vs 명상」 비교 의도: 동일 페이지에 미션별 sparkline 으로 한눈에 보임
  const missionHourly = (() => {
    const map = new Map() // mission_id → { hourly: number[24], peakHour, peakCount, total }
    for (const v of stats?._raw || []) {
      const mid = v.mission_id
      if (!map.has(mid)) map.set(mid, { hourly: new Array(24).fill(0), total: 0 })
      const bucket = map.get(mid)
      bucket.hourly[getKstHour(v.submitted_at)]++
      bucket.total++
    }
    for (const bucket of map.values()) {
      let peakHour = null, peakCount = -1
      for (let h = 0; h < 24; h++) {
        if (bucket.hourly[h] > peakCount) { peakCount = bucket.hourly[h]; peakHour = h }
      }
      bucket.peakHour = peakHour
      bucket.peakCount = peakCount
    }
    return map
  })()

  // 미션별 「누가 몇 건 인증했는지」 — _raw(mission_id·user_id) + userStats(닉네임) 로 클라 집계.
  //   추가 쿼리 없음. 건수 많은 순 정렬.
  const missionUsers = (() => {
    const nickOf = new Map((stats?.userStats || []).map(u => [u.user_id, u.nickname]))
    const perMission = new Map()   // mission_id → Map(user_id → count)
    for (const v of stats?._raw || []) {
      if (!perMission.has(v.mission_id)) perMission.set(v.mission_id, new Map())
      const um = perMission.get(v.mission_id)
      um.set(v.user_id, (um.get(v.user_id) || 0) + 1)
    }
    const out = new Map()
    for (const [mid, um] of perMission) {
      out.set(mid, Array.from(um, ([user_id, count]) => ({
        user_id, count, nickname: nickOf.get(user_id) || '(알 수 없음)',
      })).sort((a, b) => b.count - a.count))
    }
    return out
  })()

  // 미션 전체를 건수순으로 평탄화 + 번들별 색상 부여 (레퍼런스 랭킹 카드)
  const rankedMissions = (() => {
    const colorByBundle = new Map()
    let ci = 0
    const list = []
    for (const b of stats?.bundleStats || []) {
      const key = b.bundleTitle || '__solo__'
      if (!colorByBundle.has(key)) { colorByBundle.set(key, BUNDLE_PALETTE[ci % BUNDLE_PALETTE.length]); ci++ }
      const color = colorByBundle.get(key)
      const tagLabel = b.bundleTitle || '단독 미션'
      for (const m of b.missions) list.push({ ...m, bundleTitle: b.bundleTitle, tagLabel, color })
    }
    return list.sort((a, b) => b.count - a.count)
  })()

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar
        fallbackPath={`/programs/${id}/stats`}
        title="통계로"
        breadcrumb={[program.name, '통계', '미션별']}
      />

      {isStatsLoading || !stats ? (
        <LoadingState />
      ) : stats.bundleStats.length === 0 ? (
        <EmptyState icon="📊" title="아직 인증 기록이 없어요" />
      ) : (
        <div className="space-y-3">
          {/* 가장 활발한 시간대 — 미션 통틀어 전체 인증 몰리는 시간대 + 24시간 막대 */}
          {hasHourData && (
            <Reveal index={0}>
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <p className="text-[11px] font-bold text-emerald-600 tracking-wide mb-1">가장 활발한 시간대</p>
                <h2 className="text-2xl font-extrabold text-gray-900 mb-2">{rangeLabel}</h2>
                <p className="text-[13px] text-gray-500 leading-relaxed mb-4">
                  전체 인증 <b className="text-gray-700">{grandTotal}건</b> 중 <b className="text-emerald-600"><CountUp value={windowPct} suffix="%" /></b>가 이 시간대에 몰려요. 새 미션을 이 시간대에 맞추면 참여가 오를 수 있어요.
                </p>
                <PeakHourChart hourly={programHourly} windowSet={windowSet} />
              </div>
            </Reveal>
          )}

          {/* 미션별 인증 — 번들 색상별 랭킹 카드 (건수순) */}
          <Reveal index={hasHourData ? 1 : 0}>
            <div className="flex items-center justify-between px-1 mb-2 mt-1">
              <h3 className="text-base font-bold text-gray-900">미션별 인증</h3>
              <span className="text-xs text-gray-400">건수순</span>
            </div>
          </Reveal>
          <div className="space-y-3">
            {rankedMissions.map((m, i) => {
                const c = m.color
                const mShare = grandTotal > 0 ? Math.round((m.count / grandTotal) * 100) : 0
                const hourData = missionHourly.get(m.mission_id)
                const peakBucket = hourData?.peakHour != null ? bucketOfHour(hourData.peakHour) : null
                const users = missionUsers.get(m.mission_id) || []
                const isOpen = openMission === m.mission_id
                return (
                  <Reveal key={m.mission_id} index={(hasHourData ? 2 : 1) + i}>
                  <div className="bg-white border border-gray-200 rounded-2xl p-4">
                    {/* 상단 — 순위·제목·태그·참여 / 건수·% */}
                    <button
                      type="button"
                      onClick={() => toggleMission(m.mission_id)}
                      disabled={users.length === 0}
                      className="w-full text-left disabled:cursor-default"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`w-6 h-6 rounded-full ${c.badge} text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate">{m.title}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${c.tag}`}>{m.tagLabel}</span>
                            {users.length > 0 && <span className="text-[11px] text-gray-400">참여 {users.length}명</span>}
                            {users.length > 0 && <ChevronDown className={`w-3.5 h-3.5 text-gray-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xl font-extrabold text-gray-900 leading-none"><CountUp value={m.count} /><span className="text-xs font-bold text-gray-500 ml-0.5">건</span></p>
                          {grandTotal > 0 && <p className={`text-xs font-bold mt-1 ${c.text}`}><CountUp value={mShare} suffix="%" /></p>}
                        </div>
                      </div>
                    </button>

                    {/* 인증자 명단 (펼침) — 탭하면 그 사람의 이 미션 인증 게시물로 */}
                    {isOpen && users.length > 0 && (
                      <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 divide-y divide-gray-100">
                        {users.map(u => (
                          <button
                            key={u.user_id}
                            type="button"
                            onClick={() => {
                              const bundleParam = m.bundleTitle ? encodeURIComponent(m.bundleTitle) : 'solo'
                              navigate(`/programs/${id}/stats/users/${u.user_id}/verifications/${bundleParam}/${m.mission_id}?from=missions`)
                            }}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-white transition text-left"
                          >
                            <span className="text-gray-700 truncate">{u.nickname}</span>
                            <span className="text-gray-500 font-semibold whitespace-nowrap flex-shrink-0">{u.count}건 ›</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 미니 24h 막대 + 피크 칩 */}
                    <div className="mt-3">
                      {hourData && hourData.total > 0 ? (
                        <>
                          <MiniHourBars hourly={hourData.hourly} peakHour={hourData.peakHour} hex={c.hex} />
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-gray-400">0 — 12 — 24시</span>
                            {peakBucket && (
                              <span className={`inline-flex items-center gap-1 px-2 py-1 bg-white border rounded-pill text-[11px] font-medium whitespace-nowrap flex-shrink-0 ${c.pill}`}>
                                🕐 피크 {formatHour12(hourData.peakHour)}
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-gray-400 italic">{NO_DATA_HINT}</p>
                      )}
                    </div>
                  </div>
                  </Reveal>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProgramStatsMissionsPage
