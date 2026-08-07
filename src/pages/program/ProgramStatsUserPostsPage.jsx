import { useState, useEffect, useMemo } from 'react'
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

  const { data: userPosts = [], isLoading: isPostsLoading } = useQuery({
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

  // 가려진(hidden) 글의 신고 사유 — reports 테이블 (운영자 RLS 허용). 신고 누적 자동 숨김.
  const hiddenIds = useMemo(() => userPosts.filter(p => p.status === 'hidden').map(p => p.id), [userPosts])
  const { data: hideReasons = {} } = useQuery({
    queryKey: ['stats', 'userPostHideReasons', id, hiddenIds.join(',')],
    queryFn: async () => {
      if (hiddenIds.length === 0) return {}
      const { data, error } = await supabase
        .from('reports')
        .select('target_id, reason, created_at')
        .eq('target_type', 'post')
        .in('target_id', hiddenIds)
        .order('created_at', { ascending: true })
      if (error) throw error
      const map = {}
      for (const r of (data || [])) {
        const t = r.target_id
        if (!map[t]) map[t] = []
        if (r.reason && r.reason.trim()) map[t].push(r.reason.trim())
      }
      return map
    },
    enabled: !!session && !!id && isOwner && hiddenIds.length > 0,
  })

  // 게시글 이미지 signed URL (community-posts 버킷, 배치)
  const [imageUrls, setImageUrls] = useState({})
  useEffect(() => {
    let cancelled = false
    const withImg = userPosts.filter(p => p.image_path)
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
  }, [userPosts])

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
        <p className="text-xs text-gray-500 mb-1">{userInfo?.nickname || '(유저)'}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2"><img src="/icons/mypage/posts.png" alt="" aria-hidden="true" className="w-7 h-7 object-contain" /> 작성한 게시글</h1>
      </div>

      {isPostsLoading ? (
        <LoadingState variant="card" />
      ) : userPosts.length === 0 ? (
        <EmptyState icon="📝" title="작성한 게시글이 없어요" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
          {userPosts.map(p => (
            <div key={p.id} className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-semibold flex-shrink-0">{boardName(p.board_id)}</span>
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
              {/* 가려진 글 — 신고/숨김 사유 */}
              {p.status === 'hidden' && (
                <div className="mt-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                  <p className="text-[11px] font-bold text-red-500 mb-0.5">숨김 사유</p>
                  {(hideReasons[p.id] && hideReasons[p.id].length > 0) ? (
                    <ul className="space-y-0.5">
                      {hideReasons[p.id].map((r, i) => (
                        <li key={i} className="text-[13px] text-gray-700 whitespace-pre-wrap break-words">• {r}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-gray-500">신고가 누적되어 자동으로 가려졌어요 (입력된 사유 없음)</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ProgramStatsUserPostsPage
