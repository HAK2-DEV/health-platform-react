import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Heart, MessageCircle, BarChart3, Send, Trash2, Pencil } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { formatRelativeKstDay } from '../../lib/formatters'
import { queryKeys, fetchFeedPosts, FEED_PAGE_SIZE, formatKstDate, updateVerificationNote } from '../../lib/queries'
import OperatorVerificationActions from './OperatorVerificationActions'
import UserAvatar from '../../components/common/UserAvatar'
import EmptyState from '../../components/common/EmptyState'
import LoadingState from '../../components/common/LoadingState'

// 피드 본문 — ProgramFeedPage / ProgramDetailPage 「커뮤니티」 탭 공유.
// 본인 결정 (Day 58): 커뮤니티 탭 클릭 시 진입 카드 없이 바로 피드 노출 → UX 자연스러움.
//
// props:
//   program: 프로그램 객체 (feed_enabled 체크 + program.id 사용)
//   targetVerificationId: 알림 ?v= 자동 스크롤 (ProgramFeedPage 단독 진입용)
//   targetCommentId: 알림 ?c= 자동 스크롤 (위와 동일)
function FeedContent({ program, targetVerificationId = null, targetCommentId = null }) {
  const id = program.id
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const myUserId = session?.user?.id

  const postRefs = useRef({})
  const commentRefs = useRef({})
  const [highlightedPostId, setHighlightedPostId] = useState(null)
  const [highlightedCommentId, setHighlightedCommentId] = useState(null)

  // 페이지네이션 — 한 번에 10개씩. 더보기 클릭으로 다음 10개 fetch.
  const {
    data: infiniteData,
    isLoading: isPostsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.feedPosts(id),
    queryFn: ({ pageParam = 0 }) => fetchFeedPosts(id, pageParam, FEED_PAGE_SIZE),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < FEED_PAGE_SIZE) return undefined
      return allPages.length
    },
    initialPageParam: 0,
    enabled: !!session && !!id && !!program?.feed_enabled,
  })
  const posts = infiniteData?.pages.flat() || []

  // 타겟 댓글 또는 게시물로 스크롤 (ProgramFeedPage 단독 진입 시만 의미)
  useEffect(() => {
    if (posts.length === 0) return
    if (targetCommentId) {
      const el = commentRefs.current[targetCommentId]
      if (!el) return
      const t = setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlightedCommentId(targetCommentId)
        setTimeout(() => setHighlightedCommentId(null), 2500)
      }, 250)
      return () => clearTimeout(t)
    }
    if (targetVerificationId) {
      const el = postRefs.current[targetVerificationId]
      if (!el) return
      const t = setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setHighlightedPostId(targetVerificationId)
        setTimeout(() => setHighlightedPostId(null), 2500)
      }, 250)
      return () => clearTimeout(t)
    }
  }, [targetVerificationId, targetCommentId, posts.length])

  // 이미지 signed URL — feed posts 의 image_path
  const [imageUrls, setImageUrls] = useState({})
  const [failedImageIds, setFailedImageIds] = useState(() => new Set())
  useEffect(() => {
    const targets = posts.filter(p => p.image_path)
    if (targets.length === 0) {
      setImageUrls({})
      setFailedImageIds(new Set())
      return
    }
    let cancelled = false
    Promise.all(
      targets.map(p =>
        supabase.storage
          .from('verification-images')
          .createSignedUrl(p.image_path, 3600)
          .then(({ data, error }) => {
            if (error) {
              console.warn('[feed signed url 실패]', {
                path: p.image_path,
                verification_id: p.id,
                msg: error.message,
              })
              return { id: p.id, url: null }
            }
            return { id: p.id, url: data?.signedUrl || null }
          })
          .catch((err) => {
            console.warn('[feed signed url 예외]', {
              path: p.image_path,
              verification_id: p.id,
              err: err?.message,
            })
            return { id: p.id, url: null }
          })
      )
    ).then(results => {
      if (cancelled) return
      const urlMap = {}
      const failedIds = new Set()
      for (const r of results) {
        if (r.url) urlMap[r.id] = r.url
        else failedIds.add(r.id)
      }
      setImageUrls(urlMap)
      setFailedImageIds(failedIds)
    })
    return () => { cancelled = true }
  }, [posts.length])

  // 좋아요 토글
  const toggleLikeMutation = useMutation({
    mutationFn: async ({ verificationId, isLiked }) => {
      if (isLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('verification_id', verificationId)
          .eq('user_id', myUserId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({ verification_id: verificationId, user_id: myUserId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feedPosts(id) })
    },
    onError: (err) => {
      console.error('좋아요 실패:', err)
      alert(`좋아요 처리에 실패했습니다: ${err.message}`)
    },
  })

  // 댓글 추가
  const addCommentMutation = useMutation({
    mutationFn: async ({ verificationId, content }) => {
      const { error } = await supabase
        .from('post_comments')
        .insert({
          verification_id: verificationId,
          user_id: myUserId,
          content: content.trim(),
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feedPosts(id) })
    },
    onError: (err) => {
      console.error('댓글 실패:', err)
      alert(`댓글 작성에 실패했습니다: ${err.message}`)
    },
  })

  // 댓글 삭제
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId) => {
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feedPosts(id) })
    },
    onError: (err) => {
      console.error('댓글 삭제 실패:', err)
      alert(`댓글 삭제에 실패했습니다: ${err.message}`)
    },
  })

  // ─── 본인 소감 수정 (피드에서 인라인 편집) ───
  //   update_verification_note RPC 가 note 만 변경 → status/point 불변, 랭킹 영향 없음.
  const [editingNoteId, setEditingNoteId] = useState(null) // 편집 중인 post.id
  const [noteDraft, setNoteDraft] = useState('')
  const [noteError, setNoteError] = useState(null)

  const editNoteMutation = useMutation({
    mutationFn: ({ verificationId, note }) => updateVerificationNote(verificationId, note),
    onSuccess: () => {
      // 피드 + 본인 활동·개요 모두 갱신 (페이지 간 일관성)
      queryClient.invalidateQueries({ queryKey: queryKeys.feedPosts(id) })
      queryClient.invalidateQueries({ queryKey: ['my-activity'] })
      queryClient.invalidateQueries({ queryKey: ['program-overview'] })
      setEditingNoteId(null)
      setNoteError(null)
    },
    onError: (err) => {
      setNoteError(err.message || '수정에 실패했어요')
    },
  })

  const startEditNote = (post) => {
    setEditingNoteId(post.id)
    setNoteDraft(post.note || '')
    setNoteError(null)
  }
  const cancelEditNote = () => {
    setEditingNoteId(null)
    setNoteError(null)
  }

  // 운영자 여부 — 피드 게시물에 점수 제외/피드 가리기 액션 노출 (OperatorVerificationActions)
  const isProgramOwner = program.owner_id === myUserId

  // 댓글 입력 상태 — verification_id → 입력 텍스트
  const [commentInputs, setCommentInputs] = useState({})

  // 댓글 펼침 상태 — 긴 댓글 line-clamp-2 + "더 보기" 토글
  const [expandedComments, setExpandedComments] = useState(() => new Set())
  const toggleExpanded = (commentId) => {
    setExpandedComments(prev => {
      const next = new Set(prev)
      if (next.has(commentId)) next.delete(commentId)
      else next.add(commentId)
      return next
    })
  }
  const isLongComment = (content) =>
    !!content && (content.length > 60 || content.includes('\n'))

  const handleCommentSubmit = (verificationId) => {
    const content = (commentInputs[verificationId] || '').trim()
    if (!content) return
    addCommentMutation.mutate(
      { verificationId, content },
      {
        onSuccess: () => {
          setCommentInputs(prev => ({ ...prev, [verificationId]: '' }))
        },
      }
    )
  }

  const handleCommentDelete = (commentId) => {
    if (!window.confirm('이 댓글을 삭제할까요?')) return
    deleteCommentMutation.mutate(commentId)
  }

  if (isPostsLoading) {
    return <LoadingState text="피드 불러오는 중..." />
  }
  if (posts.length === 0) {
    return <EmptyState icon="📭" title="아직 인증된 게시물이 없어요" />
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {posts.map(post => {
        const likedByMe = post.likedUserIds.has(myUserId)
        const inputValue = commentInputs[post.id] || ''
        const hasImage = !!post.image_path
        const hasNumeric = post.numeric_value !== null && post.numeric_value !== undefined
        const hasNote = !!post.note && post.note.trim().length > 0
        const isMyPost = post.user_id === myUserId
        const canEditNote = isMyPost && !!post.missions?.requires_note
        const isEditingNote = editingNoteId === post.id
        const isPostHighlighted = highlightedPostId === post.id
        return (
          <article
            key={post.id}
            ref={(el) => { postRefs.current[post.id] = el }}
            className={`bg-white border rounded-2xl overflow-hidden transition-all duration-500 ${
              isPostHighlighted
                ? 'border-emerald-400 ring-2 ring-emerald-200 shadow-md'
                : 'border-gray-200'
            }`}
          >
            {/* 헤더 — 닉네임 + 미션 + 시각 */}
            <div className="flex items-start justify-between gap-2 p-4 pb-2">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <UserAvatar
                  avatarPath={post.user?.avatar_path}
                  nickname={post.user?.nickname}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">
                    {post.user?.nickname || '(알 수 없음)'}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {post.missions?.title}
                    {post.missions?.bundle_title && (
                      <span className="text-gray-400"> · {post.missions.bundle_title}</span>
                    )}
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-gray-400 whitespace-nowrap pt-0.5">
                {formatRelativeKstDay(post.submitted_at)}
              </span>
            </div>

            {/* 사진 (있으면) */}
            {hasImage && (
              <div className="bg-gray-50">
                {imageUrls[post.id] ? (
                  <img
                    src={imageUrls[post.id]}
                    alt="인증 사진"
                    className="w-full max-h-[500px] object-contain bg-black/5"
                  />
                ) : failedImageIds.has(post.id) ? (
                  <div className="p-8 text-gray-400 text-xs text-center bg-gray-50 border-y border-gray-100">
                    <div className="text-2xl mb-1 opacity-40">🖼️</div>
                    사진을 불러올 수 없어요
                  </div>
                ) : (
                  <div className="p-12 text-gray-400 text-xs text-center">
                    사진 불러오는 중...
                  </div>
                )}
              </div>
            )}

            {/* 좋아요 + 댓글 액션 바 */}
            <div className="flex items-center gap-3 px-4 pt-3">
              <button
                type="button"
                onClick={() => toggleLikeMutation.mutate({ verificationId: post.id, isLiked: likedByMe })}
                disabled={toggleLikeMutation.isPending}
                className="flex items-center gap-1 text-sm transition disabled:opacity-50"
              >
                <Heart className={`w-5 h-5 ${likedByMe ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                <span className={likedByMe ? 'text-red-500 font-medium' : 'text-gray-600'}>
                  {post.likeCount}
                </span>
              </button>
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <MessageCircle className="w-5 h-5" />
                <span>{post.comments.length}</span>
              </div>

              {/* 운영자 전용 — 점수 제외 / 피드 가리기 */}
              {isProgramOwner && (
                <OperatorVerificationActions
                  verification={{ id: post.id, status: 'APPROVED', feed_visible: true, nickname: post.user?.nickname }}
                  programId={id}
                  feedEnabled
                  layout="bar"
                />
              )}
            </div>

            {/* 숫자/소감 (있으면) */}
            {(hasNumeric || hasNote || canEditNote) && (
              <div className="px-4 pt-2 space-y-1">
                {hasNumeric && (
                  <p className="text-sm text-gray-700 flex items-center gap-1">
                    <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
                    기록: <span className="font-medium">{post.numeric_value}</span>
                  </p>
                )}

                {isEditingNote ? (
                  <div>
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      rows={3}
                      maxLength={300}
                      autoFocus
                      disabled={editNoteMutation.isPending}
                      placeholder="소감을 입력해주세요"
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-400 disabled:bg-gray-50 resize-none text-sm"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[11px] text-gray-400">{noteDraft.length}/300</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={cancelEditNote}
                          disabled={editNoteMutation.isPending}
                          className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 rounded-lg transition disabled:opacity-50"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={() => editNoteMutation.mutate({ verificationId: post.id, note: noteDraft })}
                          disabled={editNoteMutation.isPending}
                          className="px-3 py-1 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition disabled:opacity-50"
                        >
                          {editNoteMutation.isPending ? '저장 중...' : '저장'}
                        </button>
                      </div>
                    </div>
                    {noteError && (
                      <p className="mt-1 text-[11px] text-red-600">{noteError}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    {hasNote && (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap flex-1 min-w-0">
                        <span className="font-medium">{post.user?.nickname}</span>{' '}
                        {post.note}
                      </p>
                    )}
                    {canEditNote && (
                      <button
                        type="button"
                        onClick={() => startEditNote(post)}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-emerald-600 hover:bg-emerald-50 rounded-lg transition flex-shrink-0"
                        title="소감 수정"
                      >
                        <Pencil className="w-3 h-3" />
                        수정
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 댓글 목록 */}
            {post.comments.length > 0 && (
              <div className="px-4 pt-2 space-y-1.5">
                {post.comments.map(c => {
                  const isMyComment = c.user_id === myUserId
                  const canDelete = isMyComment || isProgramOwner
                  const isLong = isLongComment(c.content)
                  const isExpanded = expandedComments.has(c.id)
                  const clamped = isLong && !isExpanded
                  const isCommentHighlighted = highlightedCommentId === c.id
                  return (
                    <div
                      key={c.id}
                      ref={(el) => { commentRefs.current[c.id] = el }}
                      className={`flex items-start gap-2 text-sm rounded-lg p-1.5 -mx-1.5 transition-all duration-500 ${
                        isCommentHighlighted
                          ? 'bg-amber-100 ring-2 ring-amber-300'
                          : ''
                      }`}
                    >
                      <UserAvatar
                        avatarPath={c.user?.avatar_path}
                        nickname={c.user?.nickname}
                        size="sm"
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`break-words ${clamped ? 'line-clamp-2' : ''}`}>
                          <span className="font-medium text-gray-800">{c.user?.nickname || '(?)'}</span>{' '}
                          <span className="text-gray-700 whitespace-pre-wrap">{c.content}</span>
                        </p>
                        {isLong && (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(c.id)}
                            className="text-xs text-gray-400 hover:text-gray-600 mt-0.5"
                          >
                            {isExpanded ? '접기' : '... 더 보기'}
                          </button>
                        )}
                      </div>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleCommentDelete(c.id)}
                          disabled={deleteCommentMutation.isPending}
                          className="p-0.5 text-gray-400 hover:text-red-500 transition flex-shrink-0 disabled:opacity-40"
                          title="댓글 삭제"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* 댓글 입력 */}
            <div className="flex items-center gap-2 px-4 py-3 mt-2 border-t border-gray-100">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleCommentSubmit(post.id)
                  }
                }}
                placeholder="댓글 달기..."
                maxLength={200}
                disabled={addCommentMutation.isPending}
                className="flex-1 px-3 py-1.5 text-sm bg-gray-50 rounded-full focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-400 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => handleCommentSubmit(post.id)}
                disabled={addCommentMutation.isPending || !inputValue.trim()}
                className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-full transition disabled:opacity-40"
                title="댓글 작성"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* 날짜 */}
            <p className="px-4 pb-3 text-[10px] text-gray-400 uppercase">
              {formatKstDate(new Date(post.submitted_at))}
            </p>
          </article>
        )
      })}

      {/* 더보기 — 다음 페이지 있을 때만 */}
      {hasNextPage && (
        <div className="flex justify-center pt-2 pb-4">
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
    </motion.div>
  )
}

export default FeedContent
