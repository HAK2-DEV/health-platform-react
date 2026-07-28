import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart, MessageCircle, Trash2, Send, CornerDownRight } from 'lucide-react'
import {
  fetchCommunityPostSocial, toggleCommunityPostLike,
  addCommunityPostComment, deleteCommunityPostComment,
  fetchCommentLikes, toggleCommentLike, queryKeys,
} from '../../lib/queries'
import { formatRelativeKstDay } from '../../lib/formatters'
import UserAvatar from '../common/UserAvatar'

// 커뮤니티 글 좋아요/댓글 (105) + 1단계 답글(118) — 상세(글 펼치기) 하단에 표시.
//   canReact: 좋아요 가능. canComment: 댓글/답글 입력 가능.
// stickyComposer: true 면 [본문(header)+댓글목록=스크롤] / [입력창=하단 고정] 레이아웃.
//   header: 스크롤 영역 맨 위에 넣을 글 본문(작성자·제목·본문·사진 등). 부모가 넘김.
function CommunityPostSocial({ postId, programId, myUserId, isOwner, canReact, canComment, targetCommentId = null, stickyComposer = false, header = null, commentsRef = null }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)        // { id(최상위 댓글), nickname }
  const [expanded, setExpanded] = useState(() => new Set())  // 답글 펼친 댓글 id
  const [highlight, setHighlight] = useState(null)    // 알림 ?c= 하이라이트 댓글 id
  const inputRef = useRef(null)
  const rowRefs = useRef({})

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.communityPostSocial(postId),
    queryFn: () => fetchCommunityPostSocial(postId, myUserId),
    enabled: !!postId,
  })
  const likeCount = data?.likeCount || 0
  const likedByMe = data?.likedByMe || false
  const comments = data?.comments || []

  const topLevel = useMemo(() => comments.filter(c => !c.parent_id), [comments])
  const repliesByParent = useMemo(() => {
    const m = {}
    for (const c of comments) if (c.parent_id) (m[c.parent_id] ||= []).push(c)
    return m
  }, [comments])

  // 게시판 댓글 좋아요 (답글 포함, 142)
  const commentIds = useMemo(() => comments.map(c => c.id), [comments])
  const cLikeKey = ['community-comment-likes', postId]
  const { data: cLikes = { counts: {}, mine: new Set() } } = useQuery({
    queryKey: cLikeKey,
    queryFn: () => fetchCommentLikes({ kind: 'community', commentIds, userId: myUserId }),
    enabled: commentIds.length > 0,
  })
  const cLikeMut = useMutation({
    mutationFn: ({ commentId, liked }) => toggleCommentLike({ kind: 'community', commentId, userId: myUserId, liked }),
    onMutate: async ({ commentId, liked }) => {
      await qc.cancelQueries({ queryKey: cLikeKey })
      const prev = qc.getQueryData(cLikeKey)
      qc.setQueryData(cLikeKey, (old) => {
        const counts = { ...(old?.counts || {}) }
        const mine = new Set(old?.mine || [])
        if (liked) { mine.delete(commentId); counts[commentId] = Math.max(0, (counts[commentId] || 0) - 1) }
        else { mine.add(commentId); counts[commentId] = (counts[commentId] || 0) + 1 }
        return { counts, mine }
      })
      return { prev }
    },
    onError: (e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(cLikeKey, ctx.prev); alert(`좋아요 처리 실패: ${e.message}`) },
    onSettled: () => qc.invalidateQueries({ queryKey: cLikeKey }),
  })

  // 알림 ?c= 딥링크 — 해당 댓글로 스크롤 + 하이라이트 (답글이면 스레드 먼저 펼침)
  useEffect(() => {
    if (!targetCommentId || comments.length === 0) return
    const target = comments.find(c => c.id === targetCommentId)
    if (!target) return
    if (target.parent_id && !expanded.has(target.parent_id)) {
      setExpanded(prev => new Set(prev).add(target.parent_id))
      return  // 펼친 뒤 expanded 변경으로 재실행 → 그때 스크롤
    }
    const el = rowRefs.current[targetCommentId]
    if (!el) return
    const t = setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlight(targetCommentId)
      setTimeout(() => setHighlight(null), 2500)
    }, 300)
    return () => clearTimeout(t)
  }, [comments, targetCommentId, expanded])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.communityPostSocial(postId) })
  }

  const likeMut = useMutation({
    mutationFn: () => toggleCommunityPostLike({ postId, liked: !likedByMe, userId: myUserId }),
    onSuccess: invalidate,
    onError: (e) => alert(`좋아요 처리 실패: ${e.message}`),
  })
  const addMut = useMutation({
    mutationFn: () => addCommunityPostComment({ postId, content: text.trim(), parentId: replyTo?.id || null }),
    onSuccess: () => {
      if (replyTo?.id) setExpanded(prev => new Set(prev).add(replyTo.id))
      setText(''); setReplyTo(null); invalidate()
      qc.invalidateQueries({ queryKey: ['home-stats'] })  // 대시보드 「오늘의 활동」 댓글 활동 즉시 갱신
    },
    onError: (e) => alert(`댓글 등록 실패: ${e.message}`),
  })
  const delMut = useMutation({
    mutationFn: (id) => deleteCommunityPostComment(id),
    onSuccess: invalidate,
    onError: (e) => alert(`댓글 삭제 실패: ${e.message}`),
  })

  const submit = () => { if (text.trim() && !addMut.isPending) addMut.mutate() }

  // topId: 답글이 귀속될 최상위 댓글 id. mention: 답글 입력에 미리 채울 @닉네임(답글에 답글 시)
  const startReply = (topId, nickname, mention) => {
    setReplyTo({ id: topId, nickname })
    if (mention) setText(prev => (prev.startsWith(`@${mention} `) ? prev : `@${mention} `))
    setTimeout(() => inputRef.current?.focus(), 0)
  }
  const cancelReply = () => {
    setReplyTo(null)
    if (text.startsWith('@')) setText('')
  }
  const toggleExpand = (id) => setExpanded(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  // 댓글/답글 한 줄 — topId 는 답글이 귀속될 최상위 댓글 id
  //   (컴포넌트가 아닌 렌더 함수 — 입력 타이핑 리렌더 때 댓글 행 리마운트 방지)
  const renderComment = (c, isReply, topId) => {
    const canDel = c.user_id === myUserId || isOwner
    const isHi = highlight === c.id
    const cLikeCount = cLikes.counts[c.id] || 0
    const cLiked = cLikes.mine.has(c.id)
    return (
      <div key={c.id} ref={(el) => { rowRefs.current[c.id] = el }}
        className={`flex items-start gap-2 rounded-lg transition-all duration-500 ${isHi ? 'bg-amber-100 ring-2 ring-amber-300 p-1.5 -m-1.5' : ''}`}>
        <UserAvatar avatarPath={c.user?.avatar_path} nickname={c.user?.nickname} size="sm" viewable />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-gray-800 truncate">{c.user?.nickname || '익명'}</span>
            <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelativeKstDay(c.created_at)}</span>
            {canDel && (
              <button type="button" onClick={() => delMut.mutate(c.id)} disabled={delMut.isPending}
                className="ml-auto p-0.5 text-gray-300 hover:text-red-500 transition disabled:opacity-50" title="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
            )}
          </div>
          <p className="text-[13px] text-gray-700 whitespace-pre-wrap break-words leading-snug">{c.content}</p>
          <div className="flex items-center gap-3 mt-0.5">
            {canReact ? (
              <button type="button" onClick={() => cLikeMut.mutate({ commentId: c.id, liked: cLiked })}
                className={`flex items-center gap-0.5 text-[11px] font-semibold transition ${cLiked ? 'text-rose-500' : 'text-gray-400 hover:text-rose-400'}`}>
                <Heart className={`w-3 h-3 ${cLiked ? 'fill-current' : ''}`} />{cLikeCount > 0 ? ` ${cLikeCount}` : ''}
              </button>
            ) : (
              cLikeCount > 0 && (
                <span className="flex items-center gap-0.5 text-[11px] font-semibold text-rose-400">
                  <Heart className="w-3 h-3 fill-current" /> {cLikeCount}
                </span>
              )
            )}
            {canComment && (
              <button type="button"
                onClick={() => startReply(topId, c.user?.nickname, isReply ? c.user?.nickname : null)}
                className="text-[11px] font-semibold text-gray-400 hover:text-emerald-600 transition">답글</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 좋아요 + 댓글 목록 (스크롤되는 부분)
  const listNode = (
    <>
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

      {/* 댓글 목록 (최상위 + 답글) */}
      {isLoading ? (
        <p className="text-xs text-gray-400 py-2">불러오는 중...</p>
      ) : topLevel.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">아직 댓글이 없어요{canComment ? ' · 첫 댓글을 남겨보세요' : ''}</p>
      ) : (
        <div className="space-y-3">
          {topLevel.map(c => {
            const replies = repliesByParent[c.id] || []
            const isOpen = expanded.has(c.id)
            return (
              <div key={c.id}>
                {renderComment(c, false, c.id)}
                {replies.length > 0 && (
                  <button type="button" onClick={() => toggleExpand(c.id)}
                    className="ml-9 mt-1 flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 transition">
                    <CornerDownRight className="w-3 h-3" /> 답글 {replies.length}개 {isOpen ? '숨기기' : '보기'}
                  </button>
                )}
                {isOpen && replies.length > 0 && (
                  <div className="ml-9 mt-2 space-y-2.5 border-l-2 border-gray-100 pl-3">
                    {replies.map(r => renderComment(r, true, c.id))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )

  // 댓글/답글 입력 (sticky 모드에선 하단 고정 바 안에, 아니면 목록 아래)
  const composerNode = canComment && (
    <>
      {replyTo && (
        <div className="flex items-center gap-1.5 mb-1.5 px-1 text-[11px] text-emerald-600">
          <CornerDownRight className="w-3 h-3" /> <b className="font-semibold">{replyTo.nickname}</b>님에게 답글
          <button type="button" onClick={cancelReply} className="ml-1 text-gray-400 hover:text-gray-600">취소</button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          maxLength={500}
          placeholder={replyTo ? '답글 달기...' : '댓글 달기...'}
          className="flex-1 min-w-0 h-10 px-3.5 rounded-full border border-gray-300 bg-gray-50 text-sm text-gray-800 placeholder:text-gray-400 outline-none transition focus:border-emerald-400 focus:bg-white"
        />
        <button type="button" onClick={submit} disabled={!text.trim() || addMut.isPending}
          className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition disabled:opacity-40 flex-shrink-0" title="등록">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </>
  )

  // B안 — 입력창만 하단 고정, 본문(header)+좋아요+댓글목록은 함께 스크롤
  if (stickyComposer) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pt-5" style={{ touchAction: 'pan-y' }}>
          {header}
          <div ref={commentsRef} style={{ scrollMarginTop: '8px' }} className="mt-4 pt-3 border-t border-gray-100">
            {listNode}
          </div>
        </div>
        {composerNode && (
          <div className="flex-shrink-0 px-5 py-3 border-t border-gray-100 bg-white">
            {composerNode}
          </div>
        )}
      </div>
    )
  }

  // 기존(인라인) — 목록 아래 입력창
  return (
    <div className="mt-4 pt-3 border-t border-gray-100">
      {listNode}
      {composerNode && <div className="mt-3">{composerNode}</div>}
    </div>
  )
}

export default CommunityPostSocial
