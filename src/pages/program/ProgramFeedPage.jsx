import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchProgram } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import FeedContent from '../../components/program/FeedContent'

// 커뮤니티 피드 — feed_enabled=true 인 프로그램의 ACTIVE 참여자끼리 인스타형 피드.
// 라우트: /programs/:id/feed  (?v=verification_id&c=comment_id 알림 자동 스크롤)
//
// 본인 결정 (Day 58): 피드 본문은 FeedContent 컴포넌트로 분리 → ProgramDetailPage
// 「커뮤니티」 탭에서도 동일 컴포넌트 임베드. 단독 페이지는 알림 진입 시에만 사용됨.
function ProgramFeedPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const [searchParams] = useSearchParams()

  // 알림 진입 시 자동 스크롤 타겟
  //   ?v=verification_id          → 게시물(article) 단위
  //   ?v=...&c=comment_id         → 해당 댓글 단위 (c 우선)
  const targetVerificationId = searchParams.get('v')
  const targetCommentId = searchParams.get('c')

  const { data: program, isLoading: isProgramLoading } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })

  if (isProgramLoading) {
    return <LoadingState variant="page" />
  }
  if (!program) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="p-4 bg-red-100 text-red-700 rounded-xl">프로그램을 찾을 수 없습니다</p>
        <Link to="/dashboard" className="block mt-4 text-emerald-600 hover:underline">← 대시보드로</Link>
      </div>
    )
  }
  if (!program.feed_enabled) {
    return (
      <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
        <StickyBackBar fallbackPath={`/programs/${id}`} title="프로그램으로" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-center">
          이 프로그램은 피드가 활성화되어 있지 않아요
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}`} title="프로그램으로" />

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{program.name}</p>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          📷 피드
        </h1>
      </div>

      <FeedContent
        program={program}
        targetVerificationId={targetVerificationId}
        targetCommentId={targetCommentId}
      />
    </div>
  )
}

export default ProgramFeedPage
