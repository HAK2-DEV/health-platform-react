import { useState, useEffect } from 'react'
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

// 내가 작성한 커뮤니티 게시글 (선택 프로그램) — 라우트: /profile/activity/:programId/posts
//   운영자용 ProgramStatsUserPostsPage 의 본인 버전(RLS: 본인 글은 상태 무관 조회 가능).
function MyActivityPostsPage() {
  const { programId } = useParams()
  const { session } = useAuth()
  const myUserId = session?.user?.id

  const { data: program } = useQuery({
    queryKey: queryKeys.program(programId),
    queryFn: () => fetchProgram(programId),
    enabled: !!session && !!programId,
  })

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['myActivity', 'posts', programId, myUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_posts')
        .select('id, board_id, title, body, image_path, status, created_at')
        .eq('program_id', programId)
        .eq('author_id', myUserId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!session && !!programId && !!myUserId,
  })

  // 게시글 이미지 signed URL (community-posts 버킷, 배치)
  const [imageUrls, setImageUrls] = useState({})
  useEffect(() => {
    let cancelled = false
    const withImg = posts.filter(p => p.image_path)
    if (withImg.length === 0) { setImageUrls({}); return }
    const paths = withImg.map(p => p.image_path)
    const pathToId = new Map(withImg.map(p => [p.image_path, p.id]))
    supabase.storage.from('community-posts').createSignedUrls(paths, 3600).then(({ data }) => {
      if (cancelled) return
      const map = {}
      for (const r of (data || [])) { const pid = pathToId.get(r.path); if (pid && r.signedUrl && !r.error) map[pid] = r.signedUrl }
      setImageUrls(map)
    })
    return () => { cancelled = true }
  }, [posts])

  if (!program) return <LoadingState variant="page" />

  return (
    <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
      <StickyBackBar fallbackPath="/profile/activity" title="활동으로" />

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2">
          <img src="/icons/mypage/posts.png" alt="" aria-hidden="true" className="w-8 h-8 object-contain" /> 내가 쓴 게시글
        </h1>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : posts.length === 0 ? (
        <EmptyState icon="📝" title="작성한 게시글이 없어요" description="커뮤니티에 글을 쓰면 여기에 모여요" variant="mint" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
          {posts.map(p => (
            <div key={p.id} className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-semibold flex-shrink-0">{boardLabel(program, p.board_id)}</span>
                {p.status === 'pending' && <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold flex-shrink-0">검토 대기</span>}
                {p.status === 'hidden' && <span className="px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 text-[10px] font-bold flex-shrink-0">🚫 가려짐</span>}
                <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0 text-right leading-tight whitespace-pre-line">{formatKstStamp(p.created_at)}</span>
              </div>
              {p.title && <p className={`text-sm font-bold mb-0.5 ${p.status === 'hidden' ? 'text-gray-400' : 'text-gray-800'}`}>{p.title}</p>}
              {p.body && <p className={`text-[13px] whitespace-pre-wrap break-words leading-snug ${p.status === 'hidden' ? 'text-gray-400' : 'text-gray-600'}`}>{p.body}</p>}
              {p.image_path && (
                imageUrls[p.id]
                  ? <img src={imageUrls[p.id]} alt="" loading="lazy" className={`mt-2 w-full max-h-[400px] object-contain rounded-lg bg-gray-50 ${p.status === 'hidden' ? 'opacity-50' : ''}`} />
                  : <p className="text-[12px] text-gray-400 mt-1">📷 이미지 불러오는 중...</p>
              )}
              {p.status === 'hidden' && (
                <p className="mt-2 text-[12px] text-red-500">신고가 누적되어 가려진 글이에요.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MyActivityPostsPage
