import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../supabaseClient'
import { formatKstStamp } from '../lib/formatters'
import { queryKeys, fetchProgram } from '../lib/queries'
import { boardLabel } from '../lib/communityBoards'
import StickyBackBar from '../components/common/StickyBackBar'
import LoadingState from '../components/common/LoadingState'
import EmptyState from '../components/common/EmptyState'

// 내가 작성한 댓글 (선택 프로그램) — 커뮤니티 글 댓글 + 인증 피드 댓글 통합.
//   라우트: /profile/activity/:programId/comments. 운영자용 ProgramStatsUserCommentsPage 의 본인 버전.
function MyActivityCommentsPage() {
  const { programId } = useParams()
  const { session } = useAuth()
  const myUserId = session?.user?.id

  const { data: program } = useQuery({
    queryKey: queryKeys.program(programId),
    queryFn: () => fetchProgram(programId),
    enabled: !!session && !!programId,
  })

  // 자유게시판 댓글
  const { data: communityComments = [], isLoading: l1 } = useQuery({
    queryKey: ['myActivity', 'communityComments', programId, myUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_post_comments')
        .select('id, content, created_at, community_posts!inner(id, board_id, title, program_id)')
        .eq('community_posts.program_id', programId)
        .eq('user_id', myUserId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!session && !!programId && !!myUserId,
  })

  // 인증 피드 댓글
  const { data: verifComments = [], isLoading: l2 } = useQuery({
    queryKey: ['myActivity', 'verifComments', programId, myUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_comments')
        .select('id, content, created_at, verifications!inner(id, missions!inner(program_id, title))')
        .eq('verifications.missions.program_id', programId)
        .eq('user_id', myUserId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!session && !!programId && !!myUserId,
  })

  const allComments = useMemo(() => {
    const a = communityComments.map(c => ({
      id: 'c' + c.id, content: c.content, created_at: c.created_at,
      tag: boardLabel(program, c.community_posts?.board_id), parent: c.community_posts?.title || '게시글',
    }))
    const b = verifComments.map(c => ({
      id: 'f' + c.id, content: c.content, created_at: c.created_at,
      tag: '인증', parent: c.verifications?.missions?.title || '인증 미션',
    }))
    return [...a, ...b].sort((x, y) => new Date(y.created_at) - new Date(x.created_at))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityComments, verifComments, program])

  if (!program) return <LoadingState variant="page" />

  return (
    <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
      <StickyBackBar fallbackPath="/profile/activity" title="활동으로" />

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2">
          <img src="/icons/mypage/comments.png" alt="" aria-hidden="true" className="w-8 h-8 object-contain" /> 내가 쓴 댓글
        </h1>
      </div>

      {(l1 || l2) ? (
        <LoadingState />
      ) : allComments.length === 0 ? (
        <EmptyState icon="💬" title="작성한 댓글이 없어요" description="인증 피드나 커뮤니티에 댓글을 남기면 여기에 모여요" variant="mint" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
          {allComments.map(c => (
            <div key={c.id} className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-semibold flex-shrink-0">{c.tag}</span>
                <span className="text-[11px] text-gray-400 truncate">↳ {c.parent}</span>
                <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0 text-right leading-tight whitespace-pre-line">{formatKstStamp(c.created_at)}</span>
              </div>
              <p className="text-[13px] text-gray-700 whitespace-pre-wrap break-words leading-snug">{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MyActivityCommentsPage
