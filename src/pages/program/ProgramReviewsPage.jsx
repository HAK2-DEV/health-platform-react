import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { ChevronRight, AlertCircle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchProgram, fetchPendingReviewsEnriched, fetchProgramQuizStats } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'

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

  // 퀴즈 채점 대기 — pendingCount > 0 인 퀴즈만
  const { data: quizStats = [] } = useQuery({
    queryKey: queryKeys.programQuizStats(id),
    queryFn: () => fetchProgramQuizStats(id),
    enabled: !!session && !!id && isOwner,
  })
  const pendingQuizzes = quizStats.filter(q => q.pendingCount > 0)
  const totalQuizPending = pendingQuizzes.reduce((s, q) => s + q.pendingCount, 0)

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
        <StickyBackBar fallbackPath={`/programs/${id}`} title="프로그램으로" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">
          운영자만 심사할 수 있어요
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}`} title="프로그램으로" />

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{program.name}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2">
          ✅ 인증 심사
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          미션 인증 대기 {pending.length}건
          {totalQuizPending > 0 && ` · 퀴즈 채점 대기 ${totalQuizPending}건`}
        </p>
      </div>

      {/* 퀴즈 채점 대기 섹션 — 있을 때만 노출 */}
      {pendingQuizzes.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-3">📝 퀴즈 채점 대기</h2>
          <div className="grid gap-3">
            {pendingQuizzes.map(q => (
              <button
                key={q.id}
                type="button"
                onClick={() => navigate(`/programs/${id}/posts/quiz/${q.id}`)}
                className="w-full flex items-center gap-3 p-4 bg-white border border-amber-200 rounded-2xl hover:bg-amber-50 hover:border-amber-400 transition text-left"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-800 truncate">{q.title}</h3>
                  <p className="text-xs text-amber-700 mt-0.5 inline-flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    채점 대기 {q.pendingCount}건 (서술형 수동 채점)
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      <h2 className="text-lg font-medium text-gray-800 mb-3">🎯 미션 인증 심사</h2>

      {isPendingLoading ? (
        <LoadingState />
      ) : pending.length === 0 ? (
        <EmptyState icon="📭" title="심사 대기 중인 인증이 없어요" />
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
                className="w-full flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-emerald-300 transition text-left"
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
