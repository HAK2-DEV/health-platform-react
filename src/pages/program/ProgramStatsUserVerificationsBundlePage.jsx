import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { formatRelativeKstDay } from '../../lib/formatters'
import { queryKeys, fetchProgram, fetchProgramStats } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'

// 한 묶음(카테고리) 안의 개별 미션 목록 — 미션마다 인증 수 + 마지막 활동
// 라우트: /programs/:id/stats/users/:userId/verifications/:bundleParam
//   bundleParam = encodeURIComponent(bundle_title)  OR  'solo' (단독 미션 그룹)
function ProgramStatsUserVerificationsBundlePage() {
  const { id, userId: targetUserId, bundleParam } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const myUserId = session?.user?.id

  const bundleTitle = bundleParam === 'solo' ? null : decodeURIComponent(bundleParam || '')

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

  // 이 묶음의 인증만 + 미션별 그루핑
  const missionGroups = useMemo(() => {
    const filtered = userVerifications.filter(v =>
      (v.missions?.bundle_title || null) === bundleTitle
    )
    const map = new Map()
    for (const v of filtered) {
      const mId = v.mission_id
      if (!map.has(mId)) {
        map.set(mId, {
          mission_id: mId,
          title: v.missions?.title || '(삭제된 미션)',
          count: 0,
          latestAt: null,
        })
      }
      const bucket = map.get(mId)
      bucket.count += 1
      if (!bucket.latestAt || v.submitted_at > bucket.latestAt) {
        bucket.latestAt = v.submitted_at
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [userVerifications, bundleTitle])

  if (!program) {
    return <LoadingState variant="page" />
  }
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <StickyBackBar fallbackPath={`/programs/${id}/stats/users/${targetUserId}/verifications`} title="목록으로" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">
          운영자만 통계를 볼 수 있어요
        </p>
      </div>
    )
  }

  const headerTitle = bundleTitle === null ? '🔹 단독 미션' : bundleTitle

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/stats/users/${targetUserId}/verifications`} title="목록으로" />

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{program.name} · {userInfo?.nickname || '(유저)'}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2">
          {headerTitle}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          미션 {missionGroups.length}개
        </p>
      </div>

      {missionGroups.length === 0 ? (
        <EmptyState icon="📊" title="아직 인증 기록이 없어요" />
      ) : (
        <div className="grid gap-3">
          {missionGroups.map(m => (
            <button
              key={m.mission_id}
              type="button"
              onClick={() => navigate(`/programs/${id}/stats/users/${targetUserId}/verifications/${bundleParam}/${m.mission_id}`)}
              className="w-full flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-emerald-300 transition text-left"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-800 truncate">
                  {m.title}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  인증 {m.count}건 · 마지막 {formatRelativeKstDay(m.latestAt)}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ProgramStatsUserVerificationsBundlePage
