import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchProgram, fetchPendingReviewsEnriched } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'

// 운영자 심사 — 한 묶음 안의 미션 목록 (미션마다 대기 건수)
// 라우트: /programs/:id/reviews/:bundleParam
function ProgramReviewsBundlePage() {
  const { id, bundleParam } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const userId = session?.user?.id

  const bundleTitle = bundleParam === 'solo' ? null : decodeURIComponent(bundleParam || '')

  const { data: program } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })

  const isOwner = program?.owner_id === userId

  const { data: pending = [] } = useQuery({
    queryKey: queryKeys.pendingReviews(id),
    queryFn: () => fetchPendingReviewsEnriched(id),
    enabled: !!session && !!id && isOwner,
  })

  // 이 묶음의 미션별 그루핑
  const missionGroups = useMemo(() => {
    const filtered = pending.filter(r => (r.m_bundle_title || null) === bundleTitle)
    const map = new Map()
    for (const r of filtered) {
      if (!map.has(r.m_id)) {
        map.set(r.m_id, { mission_id: r.m_id, title: r.m_title, point: r.m_point, count: 0 })
      }
      map.get(r.m_id).count += 1
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [pending, bundleTitle])

  if (!program) {
    return <LoadingState variant="page" />
  }
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <StickyBackBar fallbackPath={`/programs/${id}/reviews`} title="목록으로" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">
          운영자만 심사할 수 있어요
        </p>
      </div>
    )
  }

  const headerTitle = bundleTitle === null ? '🔹 단독 미션' : bundleTitle
  const total = missionGroups.reduce((s, m) => s + m.count, 0)

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/reviews`} title="목록으로" />

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{program.name}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2">
          {headerTitle}
        </h1>
        <p className="text-sm text-amber-700 mt-1">
          ⏳ 심사 대기 {total}건 · 미션 {missionGroups.length}개
        </p>
      </div>

      {missionGroups.length === 0 ? (
        <EmptyState icon="📭" title="심사 대기 중인 인증이 없어요" />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {missionGroups.map(m => (
            <button
              key={m.mission_id}
              type="button"
              onClick={() => navigate(`/programs/${id}/reviews/${bundleParam}/${m.mission_id}`)}
              className="w-full flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-emerald-300 transition text-left"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-800 truncate">{m.title}</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  ⏳ {m.count}건 · {m.point}P
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

export default ProgramReviewsBundlePage
