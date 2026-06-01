import { useParams } from 'react-router-dom'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import {
  queryKeys,
  fetchProgram,
  fetchMyVerificationsByBundle,
  MY_VERIFICATIONS_PAGE_SIZE,
} from '../lib/queries'
import StickyBackBar from '../components/common/StickyBackBar'
import LoadingState from '../components/common/LoadingState'
import EmptyState from '../components/common/EmptyState'
import MyVerificationCard from '../components/common/MyVerificationCard'

// 본인 인증 기록 — 한 묶음의 인증 카드 (시간순, 10개씩 페이지네이션)
// 라우트: /profile/activity/:programId/verifications/:bundleParam
//   bundleParam = encodeURIComponent(bundle_title) 또는 'solo'
function MyActivityVerificationsBundlePage() {
  const { programId, bundleParam } = useParams()
  const { session } = useAuth()
  const userId = session?.user?.id

  const isSolo = bundleParam === 'solo'
  const bundleTitle = isSolo ? null : decodeURIComponent(bundleParam)
  // fetch 함수는 디코딩된 원본 bundle_title (또는 'solo') 사용
  const bundleKey = isSolo ? 'solo' : bundleTitle

  const { data: program } = useQuery({
    queryKey: queryKeys.program(programId),
    queryFn: () => fetchProgram(programId),
    enabled: !!session && !!programId,
  })

  // 페이지네이션 — 10개씩
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.myVerificationsByBundle(programId, userId, bundleKey),
    queryFn: ({ pageParam = 0 }) => fetchMyVerificationsByBundle(programId, userId, bundleKey, pageParam, MY_VERIFICATIONS_PAGE_SIZE),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < MY_VERIFICATIONS_PAGE_SIZE) return undefined
      return allPages.length
    },
    initialPageParam: 0,
    enabled: !!programId && !!userId,
  })
  const verifications = data?.pages.flat() || []

  if (isLoading) return <LoadingState variant="page" />

  return (
    <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
      <StickyBackBar fallbackPath={`/profile/activity/${programId}/verifications`} title="인증 기록으로" />

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
        <p className="text-xs text-gray-500 mb-1">{program?.name}</p>
        <h1 className="text-2xl font-medium text-gray-800">
          {isSolo ? '🔹 단독 미션' : `📦 ${bundleTitle}`}
        </h1>
      </div>

      {verifications.length === 0 ? (
        <EmptyState icon="📭" title="이 묶음에 인증 기록이 없어요" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3">
            {verifications.map(v => (
              <MyVerificationCard key={v.id} v={v} />
            ))}
          </div>
          {hasNextPage && (
            <div className="flex justify-center pt-4 pb-2">
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-12 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-full border border-emerald-200 transition disabled:opacity-50"
              >
                {isFetchingNextPage ? '불러오는 중...' : '더보기'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default MyActivityVerificationsBundlePage
