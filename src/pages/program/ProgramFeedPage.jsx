import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Heart, MessageCircle, Image as ImageIcon, BarChart3, Send, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { formatRelativeKstDay } from '../../lib/formatters'
import { queryKeys, fetchProgram, fetchFeedPosts, formatKstDate } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'

// 커뮤니티 피드 — feed_enabled=true 인 프로그램의 ACTIVE 참여자끼리 인스타형 피드
// 라우트: /programs/:id/feed
function ProgramFeedPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const myUserId = session?.user?.id

  const { data: program, isLoading: isProgramLoading } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })

  const { data: posts = [], isLoading: isPostsLoading } = useQuery({
    queryKey: queryKeys.feedPosts(id),
    queryFn: () => fetchFeedPosts(id),
    enabled: !!session && !!id && !!program?.feed_enabled,
  })

  // 이미지 signed URL — feed posts 의 image_path
  const [imageUrls, setImageUrls] = useState({})
  useEffect(() => {
    const targets = posts.filter(p => p.image_path)
    if (targets.length === 0) {
      setImageUrls({})
      return
    }
    let cancelled = false
    Promise.all(
      targets.map(p =>
        supabase.storage
          .from('verification-images')
          .createSignedUrl(p.image_path, 3600)
          .then(({ data }) => ({ id: p.id, url: data?.signedUrl || null }))
          .catch(() => ({ id: p.id, url: null }))
      )
    ).then(results => {
      if (cancelled) return
      const map = {}
      for (const r of results) if (r.url) map[r.id] = r.url
      setImageUrls(map)
    })
    return () => { cancelled = true }
  }, [posts.length])

  // 좋아요 토글 — optimistic 대신 단순 invalidate (편의)
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
  // 긴 댓글 판정 — 약 2줄 임계 (한국어 모바일 폭 기준 60자 또는 줄바꿈 포함)
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

  if (isProgramLoading) {
    return <div className="p-6 max-w-4xl mx-auto text-center text-gray-500">불러오는 중...</div>
  }
  if (!program) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="p-4 bg-red-100 text-red-700 rounded">프로그램을 찾을 수 없습니다</p>
        <Link to="/dashboard" className="block mt-4 text-green-600 hover:underline">← 대시보드로</Link>
      </div>
    )
  }
  if (!program.feed_enabled) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <StickyBackBar onClick={() => navigate(`/programs/${id}`)} title="프로그램으로" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">
          이 프로그램은 피드가 활성화되어 있지 않아요
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
      <StickyBackBar onClick={() => navigate(`/programs/${id}`)} title="프로그램으로" />

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{program.name}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2">
          📷 피드
        </h1>
      </div>

      {isPostsLoading ? (
        <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500 text-sm">
          피드 불러오는 중...
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-2xl text-center">
          <div className="text-4xl mb-2 opacity-60">📭</div>
          <p className="text-sm text-gray-500">아직 인증된 게시물이 없어요</p>
        </div>
      ) : (
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
            return (
              <article key={post.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                {/* 헤더 — 닉네임 + 미션 + 시각 */}
                <div className="flex items-start justify-between gap-2 p-4 pb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800 truncate">
                      👤 {post.user?.nickname || '(알 수 없음)'}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                      {post.missions?.title}
                      {post.missions?.bundle_title && (
                        <span className="text-gray-400"> · {post.missions.bundle_title}</span>
                      )}
                    </p>
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
                </div>

                {/* 숫자/소감 (있으면) */}
                {(hasNumeric || hasNote) && (
                  <div className="px-4 pt-2 space-y-1">
                    {hasNumeric && (
                      <p className="text-sm text-gray-700 flex items-center gap-1">
                        <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
                        기록: <span className="font-medium">{post.numeric_value}</span>
                      </p>
                    )}
                    {hasNote && (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        <span className="font-medium">{post.user?.nickname}</span>{' '}
                        {post.note}
                      </p>
                    )}
                  </div>
                )}

                {/* 댓글 목록 */}
                {post.comments.length > 0 && (
                  <div className="px-4 pt-2 space-y-1.5">
                    {post.comments.map(c => {
                      const isMyComment = c.user_id === myUserId
                      const isProgramOwner = program.owner_id === myUserId
                      const canDelete = isMyComment || isProgramOwner
                      const isLong = isLongComment(c.content)
                      const isExpanded = expandedComments.has(c.id)
                      const clamped = isLong && !isExpanded
                      return (
                        <div key={c.id} className="flex items-start gap-1 text-sm">
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
        </motion.div>
      )}
    </div>
  )
}

export default ProgramFeedPage
