import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchProgram, fetchPendingReviewsEnriched } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'

// 운영자 심사 메인 — 묶음(카테고리) 목록
// 라우트: /programs/:id/reviews
function ProgramReviewsPage() {
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

  const { data: pending = [], isLoading: isPendingLoading } = useQuery({
    queryKey: queryKeys.pendingReviews(id),
    queryFn: () => fetchPendingReviewsEnriched(id),
    enabled: !!session && !!id && isOwner,
  })

  // 묶음별 그루핑
  const bundleGroups = useMemo(() => {
    const map = new Map()
    for (const r of pending) {
      const key = r.m_bundle_title || null
      if (!map.has(key)) map.set(key, { bundleTitle: key, count: 0 })
      map.get(key).count += 1
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.bundleTitle === null) return 1
      if (b.bundleTitle === null) return -1
      return b.count - a.count
    })
  }, [pending])

  if (isProgramLoading) {
    return <div className="p-6 max-w-4xl mx-auto text-center text-gray-500">불러오는 중...</div>
  }
  if (!program) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="p-4 bg-red-100 text-red-700 rounded">프로그램을 찾을 수 없습니다</p>
        <Link to="/dashboard" className="block mt-4 text-green-600 hover:underline">← 대시보드로</Link>
      </div>
    )
  }
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <StickyBackBar onClick={() => navigate(`/programs/${id}`)} title="프로그램으로" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">
          운영자만 심사할 수 있어요
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar onClick={() => navigate(`/programs/${id}`)} title="프로그램으로" />

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{program.name}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2">
          ✅ 인증 심사
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          심사 대기 {pending.length}건
        </p>
      </div>

      {isPendingLoading ? (
        <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500 text-sm">
          불러오는 중...
        </div>
      ) : pending.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-2xl text-center">
          <div className="text-4xl mb-2 opacity-60">📭</div>
          <p className="text-sm text-gray-500">심사 대기 중인 인증이 없어요</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {bundleGroups.map(group => {
            const isSolo = group.bundleTitle === null
            const bundleParam = isSolo ? 'solo' : encodeURIComponent(group.bundleTitle)
            return (
              <button
                key={group.bundleTitle || '__solo__'}
                type="button"
                onClick={() => navigate(`/programs/${id}/reviews/${bundleParam}`)}
                className="w-full flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-emerald-300 transition text-left"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-800 truncate">
                    {isSolo ? '🔹 단독 미션' : group.bundleTitle}
                  </h3>
                  <p className="text-xs text-amber-700 mt-0.5">
                    ⏳ 심사 대기 {group.count}건
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

export default ProgramReviewsPage
