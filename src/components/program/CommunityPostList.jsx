import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Pencil, Flag } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { deleteCommunityPost, queryKeys } from '../../lib/queries'
import { formatRelativeKstDay } from '../../lib/formatters'
import UserAvatar from '../common/UserAvatar'
import EmptyState from '../common/EmptyState'
import ReportModal from '../common/ReportModal'

// 게시판 글 목록 — 작성자/내용/이미지(signed URL) + 본인·운영자 삭제.
function CommunityPostList({ programId, boardId, posts = [], myUserId, isOwner, onEdit }) {
  const queryClient = useQueryClient()
  const [imageUrls, setImageUrls] = useState({})

  useEffect(() => {
    let cancelled = false
    const withImg = posts.filter(p => p.image_path)
    if (withImg.length === 0) { setImageUrls({}); return }
    // 배치 서명 — 한 번의 요청으로 묶어 라운드트립 최소화
    const paths = withImg.map(p => p.image_path)
    const pathToId = new Map(withImg.map(p => [p.image_path, p.id]))
    supabase.storage.from('community-posts').createSignedUrls(paths, 3600)
      .then(({ data }) => {
        if (cancelled) return
        const map = {}
        for (const r of data || []) {
          const pid = pathToId.get(r.path)
          if (pid != null && r.signedUrl && !r.error) map[pid] = r.signedUrl
        }
        setImageUrls(map)
      })
    return () => { cancelled = true }
  }, [posts])

  const delMutation = useMutation({
    mutationFn: (id) => deleteCommunityPost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communityPosts(programId, boardId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.communityPosts(programId, 'all') })
    },
    onError: (e) => alert(`삭제 실패: ${e.message}`),
  })
  const onDelete = (p) => { if (window.confirm('이 글을 삭제할까요?')) delMutation.mutate(p.id) }

  const [reportId, setReportId] = useState(null)

  if (posts.length === 0) {
    return <EmptyState icon="📝" title="아직 글이 없어요" description="첫 글을 남겨보세요" />
  }

  return (
    <div className="space-y-3">
      {posts.map(p => {
        const canDelete = p.author_id === myUserId || isOwner
        return (
          <article key={p.id} className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <UserAvatar avatarPath={p.author?.avatar_path} nickname={p.author?.nickname} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-800 truncate">{p.author?.nickname || '익명'}</p>
                <p className="text-[11px] text-gray-400">
                  {formatRelativeKstDay(p.created_at)}
                  {p.status === 'pending' && <span className="ml-1 text-amber-600 font-medium">· 검토 대기</span>}
                </p>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {p.author_id !== myUserId && boardId !== 'notice' && (
                  <button type="button" onClick={() => setReportId(p.id)}
                    className="p-1 text-gray-400 hover:text-amber-600 transition" title="신고"><Flag className="w-4 h-4" /></button>
                )}
                {p.author_id === myUserId && onEdit && (
                  <button type="button" onClick={() => onEdit(p)}
                    className="p-1 text-gray-400 hover:text-emerald-600 transition" title="수정"><Pencil className="w-4 h-4" /></button>
                )}
                {canDelete && (
                  <button type="button" onClick={() => onDelete(p)} disabled={delMutation.isPending}
                    className="p-1 text-gray-400 hover:text-red-500 transition disabled:opacity-50" title="삭제"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>
            {p.title && <h3 className="font-bold text-gray-800 mb-1">{p.title}</h3>}
            {p.body && <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{p.body}</p>}
            {p.image_path && imageUrls[p.id] && (
              <img src={imageUrls[p.id]} alt="" loading="lazy" className="mt-2 w-full max-h-[400px] object-contain rounded-lg bg-gray-50" />
            )}
          </article>
        )
      })}
      <ReportModal
        isOpen={reportId != null}
        onClose={() => setReportId(null)}
        programId={programId}
        targetType="post"
        targetId={reportId}
      />
    </div>
  )
}

export default CommunityPostList
