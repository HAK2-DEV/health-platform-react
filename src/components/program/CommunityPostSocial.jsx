import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart, MessageCircle, Trash2, Send } from 'lucide-react'
import {
  fetchCommunityPostSocial, toggleCommunityPostLike,
  addCommunityPostComment, deleteCommunityPostComment, queryKeys,
} from '../../lib/queries'
import { formatRelativeKstDay } from '../../lib/formatters'
import UserAvatar from '../common/UserAvatar'

// 커뮤니티 글 좋아요/댓글 (105) — 상세(글 펼치기) 하단에 표시.
//   canReact: 좋아요 가능(반응 허용 + 참여자/운영자). canComment: 댓글 입력 가능(+ commentPerm).
function CommunityPostSocial({ postId, programId, myUserId, isOwner, canReact, canComment }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.communityPostSocial(postId),
    queryFn: () => fetchCommunityPostSocial(postId, myUserId),
    enabled: !!postId,
  })
  const likeCount = data?.likeCount || 0
  const likedByMe = data?.likedByMe || false
  const comments = data?.comments || []

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.communityPostSocial(postId) })
  }

  const likeMut = useMutation({
    mutationFn: () => toggleCommunityPostLike({ postId, liked: !likedByMe, userId: myUserId }),
    onSuccess: invalidate,
    onError: (e) => alert(`좋아요 처리 실패: ${e.message}`),
  })
  const addMut = useMutation({
    mutationFn: () => addCommunityPostComment({ postId, content: text.trim() }),
    onSuccess: () => { setText(''); invalidate() },
    onError: (e) => alert(`댓글 등록 실패: ${e.message}`),
  })
  const delMut = useMutation({
    mutationFn: (id) => deleteCommunityPostComment(id),
    onSuccess: invalidate,
    onError: (e) => alert(`댓글 삭제 실패: ${e.message}`),
  })

  const submit = () => { if (text.trim() && !addMut.isPending) addMut.mutate() }

  return (
    <div className="mt-4 pt-3 border-t border-gray-100">
      {/* 좋아요 + 댓글 수 */}
      <div className="flex items-center gap-4 mb-3">
        <button type="button" onClick={() => canReact && likeMut.mutate()} disabled={!canReact || likeMut.isPending}
          className={`flex items-center gap-1.5 text-sm font-medium transition disabled:opacity-50 ${likedByMe ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
          title={canReact ? (likedByMe ? '좋아요 취소' : '좋아요') : undefined}>
          <Heart className={`w-5 h-5 ${likedByMe ? 'fill-current' : ''}`} /> {likeCount}
        </button>
        <span className="flex items-center gap-1.5 text-sm text-gray-500">
          <MessageCircle className="w-5 h-5" /> {comments.length}
        </span>
      </div>

      {/* 댓글 목록 */}
      {isLoading ? (
        <p className="text-xs text-gray-400 py-2">불러오는 중...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">아직 댓글이 없어요{canComment ? ' · 첫 댓글을 남겨보세요' : ''}</p>
      ) : (
        <div className="space-y-3">
          {comments.map(c => {
            const canDel = c.user_id === myUserId || isOwner
            return (
              <div key={c.id} className="flex items-start gap-2">
                <UserAvatar avatarPath={c.user?.avatar_path} nickname={c.user?.nickname} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-bold text-gray-800 truncate">{c.user?.nickname || '익명'}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelativeKstDay(c.created_at)}</span>
                    {canDel && (
                      <button type="button" onClick={() => delMut.mutate(c.id)} disabled={delMut.isPending}
                        className="ml-auto p-0.5 text-gray-300 hover:text-red-500 transition disabled:opacity-50" title="댓글 삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                  <p className="text-[13px] text-gray-700 whitespace-pre-wrap break-words leading-snug">{c.content}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 댓글 입력 */}
      {canComment && (
        <div className="flex items-center gap-2 mt-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            maxLength={500}
            placeholder="댓글 달기..."
            className="flex-1 h-10 px-3.5 rounded-full border border-gray-200 text-sm outline-none focus:border-emerald-400"
          />
          <button type="button" onClick={submit} disabled={!text.trim() || addMut.isPending}
            className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition disabled:opacity-40 flex-shrink-0" title="등록">
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

export default CommunityPostSocial
