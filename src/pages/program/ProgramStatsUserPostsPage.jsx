import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { formatKstStamp } from '../../lib/formatters'
import { queryKeys, fetchProgram, fetchProgramStats } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'

// 한 유저가 작성한 커뮤니티 게시글 목록
// 라우트: /programs/:id/stats/users/:userId/posts
function ProgramStatsUserPostsPage() {
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

  const { data: userPosts = [] } = useQuery({
    queryKey: ['stats', 'userPosts', id, targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_posts')
        .select('id, board_id, title, body, image_path, status, created_at')
        .eq('program_id', id)
        .eq('author_id', targetUserId)
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
        <p className="text-xs text-gray-500 mb-1">{program.name} · {userInfo?.nickname || '(유저)'}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2">📝 작성한 게시글</h1>
      </div>

      {userPosts.length === 0 ? (
        <EmptyState icon="📝" title="작성한 게시글이 없어요" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
          {userPosts.map(p => (
            <div key={p.id} className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-semibold flex-shrink-0">{boardName(p.board_id)}</span>
                {p.status === 'pending' && <span className="text-[10px] text-amber-600 font-medium flex-shrink-0">검토 대기</span>}
                {p.status === 'hidden' && <span className="text-[10px] text-red-500 font-medium flex-shrink-0">숨김</span>}
                <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0 text-right leading-tight whitespace-pre-line">{formatKstStamp(p.created_at)}</span>
              </div>
              {p.title && <p className="text-sm font-bold text-gray-800 mb-0.5">{p.title}</p>}
              {p.body && <p className="text-[13px] text-gray-600 whitespace-pre-wrap break-words leading-snug">{p.body}</p>}
              {p.image_path && <p className="text-[12px] text-gray-400 mt-1">📷 이미지 첨부</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ProgramStatsUserPostsPage
