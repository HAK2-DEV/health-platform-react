import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchProgram, fetchProgramStats } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'

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

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/stats`} title="통계로" />

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{program.name}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2">
          🎯 미션별 인증 현황
        </h1>
      </div>

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

                <div className="border-t border-gray-100 bg-gray-50/40 p-3 space-y-2">
                  {bundle.missions.map(m => {
                    const mPercent = Math.round((m.count / maxMissionCount) * 100)
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
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-300 rounded-full transition-all"
                            style={{ width: `${mPercent}%` }}
                          />
                        </div>
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
