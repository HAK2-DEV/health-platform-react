import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import {
  queryKeys,
  fetchProgram,
  fetchMyActivity,
} from '../lib/queries'
import StickyBackBar from '../components/common/StickyBackBar'
import LoadingState from '../components/common/LoadingState'
import EmptyState from '../components/common/EmptyState'

// 본인 미션별 분포 디테일
// 라우트: /profile/activity/:programId/missions
//   묶음(bundle_title) 단위로 그룹화 + 각 미션 카운트 막대
function MyActivityMissionsPage() {
  const { programId } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id

  const { data: program } = useQuery({
    queryKey: queryKeys.program(programId),
    queryFn: () => fetchProgram(programId),
    enabled: !!session && !!programId,
  })

  const { data: activity, isLoading } = useQuery({
    queryKey: queryKeys.myActivity(programId, userId),
    queryFn: () => fetchMyActivity(programId, userId),
    enabled: !!programId && !!userId,
  })

  // 묶음별 그루핑
  const bundleGroups = useMemo(() => {
    if (!activity?.missionStats) return []
    const map = new Map()
    for (const m of activity.missionStats) {
      const key = m.bundleTitle || null
      if (!map.has(key)) {
        map.set(key, { bundleTitle: key, totalCount: 0, missions: [] })
      }
      const b = map.get(key)
      b.totalCount += m.count
      b.missions.push(m)
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.bundleTitle === null) return 1
      if (b.bundleTitle === null) return -1
      return b.totalCount - a.totalCount
    })
  }, [activity])

  const maxCount = useMemo(() => {
    if (!activity?.missionStats?.length) return 1
    return Math.max(...activity.missionStats.map(m => m.count))
  }, [activity])

  if (isLoading || !activity) return <LoadingState variant="page" />

  return (
    <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
      <StickyBackBar fallbackPath="/profile/activity" title="활동으로" />

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-medium text-gray-800">
          <img src="/icons/mypage/missions.png" alt="" aria-hidden="true" className="w-8 h-8 object-contain" /> 미션별 분포
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          본인이 인증한 미션 ({activity.approvedCount}건 · {activity.missionStats.length}개 미션)
        </p>
      </div>

      {bundleGroups.length === 0 ? (
        <EmptyState icon="📭" title="아직 인증한 미션이 없어요" />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {bundleGroups.map(g => (
            <section
              key={g.bundleTitle || '__solo__'}
              className="bg-white border border-gray-200 rounded-2xl p-4"
            >
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center justify-between gap-2">
                <span className="truncate">{g.bundleTitle ? g.bundleTitle : '단독 미션'}</span>
                <span className="text-xs text-gray-500 flex-shrink-0 font-normal">{g.totalCount}건</span>
              </h2>
              <div className="space-y-2.5">
                {g.missions.map(m => {
                  const ratio = Math.round((m.count / maxCount) * 100)
                  return (
                    <div key={m.mission_id}>
                      <div className="flex items-center justify-between gap-2 mb-1 text-sm">
                        <span className="text-gray-800 truncate flex-1 min-w-0">{m.title}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {m.count}건 <span className="text-gray-400">· {m.point * m.count}P</span>
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full transition-all"
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export default MyActivityMissionsPage
