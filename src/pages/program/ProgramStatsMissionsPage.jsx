import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchProgram, fetchProgramStats } from '../../lib/queries'
import { getKstHour, formatHour12, bucketOfHour } from '../../lib/formatters'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'

// 인증 0건 미션 sparkline 자리에 표시할 메시지
const NO_DATA_HINT = '아직 인증 없음'

// 24시간 sparkline 컴포넌트 — 미션 단위 시간대 분포 시각화
// hourly: number[24], peakHour: 0-23|null
function HourSparkline({ hourly, peakHour }) {
  const max = Math.max(1, ...hourly)
  return (
    <div className="flex items-end gap-[1px] h-7" aria-label="시간대 분포">
      {hourly.map((count, h) => {
        const pct = (count / max) * 100
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
                    : `${bucket.color} opacity-50`
              }`}
              style={{ height: count === 0 ? '3px' : `${Math.max(10, pct)}%` }}
            />
          </div>
        )
      })}
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

  const maxBundleCount = stats?.bundleStats?.reduce((m, b) => Math.max(m, b.totalCount), 0) || 1
  const maxMissionCount = stats?.bundleStats?.reduce(
    (m, b) => Math.max(m, ...b.missions.map(x => x.count)),
    0
  ) || 1

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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-3"
        >
          {stats.bundleStats.map(bundle => {
            const bundlePercent = Math.round((bundle.totalCount / maxBundleCount) * 100)
            const isSolo = bundle.bundleTitle === null
            return (
              <div
                key={bundle.bundleTitle || '__solo__'}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0 pr-2">
                      {isSolo ? '🔹 단독 미션' : bundle.bundleTitle}
                    </p>
                    <span className="text-sm text-gray-700 font-semibold whitespace-nowrap">
                      {bundle.totalCount}건
                    </span>
                  </div>
                  {!isSolo && (
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${bundlePercent}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 bg-gray-50/40 p-3 space-y-3">
                  {bundle.missions.map(m => {
                    const mPercent = Math.round((m.count / maxMissionCount) * 100)
                    const hourData = missionHourly.get(m.mission_id)
                    const peakBucket = hourData?.peakHour != null ? bucketOfHour(hourData.peakHour) : null
                    return (
                      <div key={m.mission_id}>
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-xs text-gray-600 truncate flex-1 min-w-0 pr-2">
                            {m.title}
                          </p>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {m.count}건
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full bg-emerald-300 rounded-full transition-all"
                            style={{ width: `${mPercent}%` }}
                          />
                        </div>
                        {/* 시간대 sparkline + peak 시간 칩 — 미션 시간 조정 결정의 근거 */}
                        {hourData && hourData.total > 0 ? (
                          <div className="flex items-end gap-2">
                            <div className="flex-1 min-w-0">
                              <HourSparkline hourly={hourData.hourly} peakHour={hourData.peakHour} />
                              <div className="relative h-2.5 text-[9px] text-gray-400 mt-0.5">
                                <span className="absolute left-0">0</span>
                                <span className="absolute left-1/2 -translate-x-1/2">12</span>
                                <span className="absolute right-0">24</span>
                              </div>
                            </div>
                            {peakBucket && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-emerald-200 rounded-pill text-[10px] font-medium text-emerald-700 whitespace-nowrap flex-shrink-0">
                                <span>{peakBucket.emoji}</span>
                                <span>{formatHour12(hourData.peakHour)}</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-400 italic">{NO_DATA_HINT}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

export default ProgramStatsMissionsPage
