import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { formatKstStamp } from '../../lib/formatters'
import { queryKeys, fetchProgram, fetchProgramStats } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'

// 한 유저가 작성한 댓글 — 커뮤니티 글 댓글(105) + 인증 피드 댓글(036) 통합
// 라우트: /programs/:id/stats/users/:userId/comments
function ProgramStatsUserCommentsPage() {
  const { id, userId: targetUserId } = useParams()
  const { session } = useAuth()
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
  const userInfo = stats?.userStats?.find(u => u.user_id === targetUserId) || null

  const { data: userComments = [], isLoading: isCommentsLoading } = useQuery({
    queryKey: ['stats', 'userComments', id, targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_post_comments')
        .select('id, content, created_at, community_posts!inner(id, board_id, title, program_id)')
        .eq('community_posts.program_id', id)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!session && !!id && !!targetUserId && isOwner,
  })

  const { data: userVerifComments = [], isLoading: isVerifCommentsLoading } = useQuery({
    queryKey: ['stats', 'userVerifComments', id, targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_comments')
        .select('id, content, created_at, verifications!inner(id, missions!inner(program_id, title))')
        .eq('verifications.missions.program_id', id)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!session && !!id && !!targetUserId && isOwner,
  })

  const boardName = (bid) => {
    const boards = program?.community_settings?.boards
    const b = Array.isArray(boards) ? boards.find(x => x.id === bid) : null
    return b?.name || bid
  }

  const allComments = useMemo(() => {
    const a = userComments.map(c => ({
      id: c.id, content: c.content, created_at: c.created_at,
      tag: boardName(c.community_posts?.board_id), parent: c.community_posts?.title || '게시글',
    }))
    const b = userVerifComments.map(c => ({
      id: c.id, content: c.content, created_at: c.created_at,
      tag: '인증', parent: c.verifications?.missions?.title || '인증 미션',
    }))
    return [...a, ...b].sort((x, y) => new Date(y.created_at) - new Date(x.created_at))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userComments, userVerifComments, program])

  if (!program) return <LoadingState variant="page" />
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <StickyBackBar fallbackPath={`/programs/${id}/stats/users/${targetUserId}`} title="돌아가기" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">운영자만 통계를 볼 수 있어요</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/stats/users/${targetUserId}`} title="돌아가기" />

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{userInfo?.nickname || '(유저)'}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2"><img src="/icons/mypage/comments.png" alt="" aria-hidden="true" className="w-7 h-7 object-contain" /> 작성한 댓글</h1>
      </div>

      {(isCommentsLoading || isVerifCommentsLoading) ? (
        <LoadingState variant="card" />
      ) : allComments.length === 0 ? (
        <EmptyState icon="💬" title="작성한 댓글이 없어요" />
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

export default ProgramStatsUserCommentsPage
