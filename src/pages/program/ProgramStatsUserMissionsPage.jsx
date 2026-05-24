import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { queryKeys, fetchProgram, fetchProgramStats } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'

// 한 유저의 미션별 분포 — 묶음 그룹 + 안에 미션별 카운트
// 라우트: /programs/:id/stats/users/:userId/missions
function ProgramStatsUserMissionsPage() {
  const { id, userId: targetUserId } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const myUserId = session?.user?.id

  const { data: program } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })

  const isOwner = program?.owner_id === myUserId

  const { data: stats } = useQuery({
    queryKey: queryKeys.programStats(id),
    queryFn: () => fetchProgramStats(id),
    enabled: !!session && !!id && isOwner,
  })

  const { data: userVerifications = [] } = useQuery({
    queryKey: ['stats', 'userVerifications', id, targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('verifications')
        .select('id, mission_id, submitted_at, image_path, numeric_value, note, missions!inner(program_id, title, bundle_title)')
        .eq('missions.program_id', id)
        .eq('user_id', targetUserId)
        .eq('status', 'APPROVED')
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!session && !!id && !!targetUserId && isOwner,
  })

  const userInfo = stats?.userStats?.find(u => u.user_id === targetUserId) || null

  // 묶음 → 미션 그루핑
  const bundleGroups = useMemo(() => {
    const map = new Map()
    for (const v of userVerifications) {
      const bKey = v.missions?.bundle_title || null
      if (!map.has(bKey)) {
        map.set(bKey, { bundleTitle: bKey, totalCount: 0, missions: new Map() })
      }
      const bucket = map.get(bKey)
      bucket.totalCount += 1
      const mKey = v.mission_id
      if (!bucket.missions.has(mKey)) {
        bucket.missions.set(mKey, {
          mission_id: mKey,
          title: v.missions?.title || '(삭제된 미션)',
          count: 0,
        })
      }
      bucket.missions.get(mKey).count += 1
    }
    // Map → Array, 정렬 (단독은 맨 아래)
    return Array.from(map.values())
      .map(g => ({ ...g, missions: Array.from(g.missions.values()).sort((a, b) => b.count - a.count) }))
      .sort((a, b) => {
        if (a.bundleTitle === null) return 1
        if (b.bundleTitle === null) return -1
        return b.totalCount - a.totalCount
      })
  }, [userVerifications])

  if (!program) {
    return <div className="p-6 max-w-4xl mx-auto text-center text-gray-500">불러오는 중...</div>
  }
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <StickyBackBar onClick={() => navigate(`/programs/${id}/stats/users/${targetUserId}`)} title="돌아가기" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">
          운영자만 통계를 볼 수 있어요
        </p>
      </div>
    )
  }

  const maxBundleCount = bundleGroups.reduce((m, b) => Math.max(m, b.totalCount), 0) || 1
  const maxMissionCount = bundleGroups.reduce(
    (m, b) => Math.max(m, ...b.missions.map(x => x.count)),
    0
  ) || 1

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar onClick={() => navigate(`/programs/${id}/stats/users/${targetUserId}`)} title="돌아가기" />

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{program.name} · {userInfo?.nickname || '(유저)'}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2">
          🎯 미션별 분포
        </h1>
      </div>

      {bundleGroups.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500 text-sm">
          아직 인증 기록이 없어요
        </div>
      ) : (
        <div className="space-y-3">
          {bundleGroups.map(group => {
            const bundlePercent = Math.round((group.totalCount / maxBundleCount) * 100)
            const isSolo = group.bundleTitle === null
            return (
              <div
                key={group.bundleTitle || '__solo__'}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0 pr-2">
                      {isSolo ? '🔹 단독 미션' : group.bundleTitle}
                    </p>
                    <span className="text-sm text-gray-700 font-semibold whitespace-nowrap">
                      {group.totalCount}건
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
                  {group.missions.map(m => {
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
        </div>
      )}
    </div>
  )
}

export default ProgramStatsUserMissionsPage
