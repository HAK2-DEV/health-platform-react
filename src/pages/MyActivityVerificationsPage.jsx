import { useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import {
  queryKeys,
  fetchProgram,
  fetchMyActivity,
} from '../lib/queries'
import StickyBackBar from '../components/common/StickyBackBar'
import LoadingState from '../components/common/LoadingState'
import EmptyState from '../components/common/EmptyState'

// 본인 인증 기록 — 묶음 목록 (운영자 ProgramStatsUserVerificationsPage 미러)
// 라우트: /profile/activity/:programId/verifications
//   bundle_title 단위로 그룹화 → 클릭 시 그 묶음의 인증 카드들
function MyActivityVerificationsPage() {
  const { programId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  // 기록하기 흐름에서 「내 기록 보기」로 진입 시 — 뒤로가기는 기록하기 화면으로
  const backTo = location.state?.backTo
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

  // bundle_title 별 그루핑 (모든 상태 포함 — APPROVED/PENDING/REJECTED 다 본인 활동)
  const bundleGroups = useMemo(() => {
    if (!activity?.verifications) return []
    const map = new Map()
    for (const v of activity.verifications) {
      const key = v.missions?.bundle_title || null
      if (!map.has(key)) {
        map.set(key, { bundleTitle: key, count: 0, latestAt: null })
      }
      const b = map.get(key)
      b.count += 1
      if (!b.latestAt || v.submitted_at > b.latestAt) b.latestAt = v.submitted_at
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.bundleTitle === null) return 1
      if (b.bundleTitle === null) return -1
      return b.count - a.count
    })
  }, [activity])

  if (isLoading || !activity) return <LoadingState variant="page" />

  return (
    <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
      <StickyBackBar
        onClick={backTo ? () => navigate(backTo, { replace: true }) : undefined}
        fallbackPath="/profile/activity"
        title={backTo?.startsWith('/record') ? '기록하기로' : backTo ? '돌아가기' : '활동으로'}
      />

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
        <p className="text-xs text-gray-500 mb-1">{program?.name}</p>
        <h1 className="text-2xl font-medium text-gray-800">📝 인증 기록</h1>
        <p className="text-xs text-gray-500 mt-1">
          총 {activity.totalCount}건
          {activity.pendingCount > 0 && <span className="text-amber-600"> · 심사 대기 {activity.pendingCount}</span>}
          {activity.rejectedCount > 0 && <span className="text-red-500"> · 반려 {activity.rejectedCount}</span>}
        </p>
      </div>

      {bundleGroups.length === 0 ? (
        <EmptyState icon="📭" title="아직 인증 기록이 없어요" />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {bundleGroups.map(group => {
            const isSolo = group.bundleTitle === null
            const bundleParam = isSolo ? 'solo' : encodeURIComponent(group.bundleTitle)
            return (
              <button
                key={group.bundleTitle || '__solo__'}
                type="button"
                onClick={() => navigate(`/profile/activity/${programId}/verifications/${bundleParam}`)}
                className="w-full flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-emerald-300 transition text-left"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-800 truncate">
                    {isSolo ? '🔹 단독 미션' : group.bundleTitle}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    인증 {group.count}건
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MyActivityVerificationsPage
