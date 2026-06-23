import { useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Heart, MessageCircle, BarChart3, Send, Trash2, Pencil, Flag } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { formatRelativeKstDay } from '../../lib/formatters'
import { queryKeys, fetchFeedPosts, fetchPostComments, FEED_PAGE_SIZE, formatKstDate, updateVerificationNote } from '../../lib/queries'
import OperatorVerificationActions from './OperatorVerificationActions'
import UserAvatar from '../../components/common/UserAvatar'
import EmptyState from '../../components/common/EmptyState'
import LoadingState from '../../components/common/LoadingState'
import ReportModal from '../common/ReportModal'

// 피드 본문 — ProgramFeedPage / ProgramDetailPage 「커뮤니티」 탭 공유.
// 본인 결정 (Day 58): 커뮤니티 탭 클릭 시 진입 카드 없이 바로 피드 노출 → UX 자연스러움.
//
// props:
//   program: 프로그램 객체 (feed_enabled 체크 + program.id 사용)
//   targetVerificationId: 알림 ?v= 자동 스크롤 (ProgramFeedPage 단독 진입용)
//   targetCommentId: 알림 ?c= 자동 스크롤 (위와 동일)
function FeedContent({ program, layout: layoutProp = null, targetVerificationId = null, targetCommentId = null, readOnly = false }) {
  const id = program.id
  // 반응(좋아요·댓글) 허용 — 커뮤니티 ③ 토글(community_settings.reactionAuto). 기본 허용.
  const reactionsEnabled = program.community_settings?.reactionAuto !== false
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const myUserId = session?.user?.id

  const postRefs = useRef({})
  const [highlightedPostId, setHighlightedPostId] = useState(null)
  // 댓글 펼침 — 아이콘 클릭 시 그 게시물 댓글 lazy 로드. 알림 ?v= 진입 시 해당 게시물 자동 펼침.
  const [openComments, setOpenComments] = useState(() => new Set(targetVerificationId ? [targetVerificationId] : []))
  const toggleComments = (vid) => setOpenComments(prev => {
    const next = new Set(prev)
    if (next.has(vid)) next.delete(vid)
    else next.add(vid)
    return next
  })

  // 인증 신고 (100) — 누적 시 트리거가 feed_visible=false 로 자동 숨김. UI 모달(ReportModal)로 처리.
  const [reportVid, setReportVid] = useState(null)

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
  const [focusedId, setFocusedId] = useState(null)  // 그리드/매거진 — 카드 탭 시 단일 게시물 풀뷰

  // 타겟 게시물로 스크롤 (알림 ?v=). 댓글(?c=) 스크롤·하이라이트는 CommentsSection 이 자체 처리.
  useEffect(() => {
    if (posts.length === 0) return
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
  }, [targetVerificationId, posts.length])

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
    // 배치 서명 — N건을 한 번의 요청으로 묶어 라운드트립 최소화(이미지 노출 지연 완화)
    const paths = targets.map(p => p.image_path)
    const pathToId = new Map(targets.map(p => [p.image_path, p.id]))
    supabase.storage
      .from('verification-images')
      .createSignedUrls(paths, 3600)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[feed signed urls 실패]', { msg: error.message })
          setImageUrls({})
          setFailedImageIds(new Set(targets.map(p => p.id)))
          return
        }
        const urlMap = {}
        const failedIds = new Set()
        for (const r of data || []) {
          const pid = pathToId.get(r.path)
          if (pid == null) continue
          if (r.signedUrl && !r.error) urlMap[pid] = r.signedUrl
          else failedIds.add(pid)
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

  if (isPostsLoading) {
    return <LoadingState text="피드 불러오는 중..." />
  }
  if (posts.length === 0) {
    return <EmptyState icon="📭" title="아직 인증된 게시물이 없어요" />
  }

  // 커뮤니티 레이아웃 (093) — list(기본) / grid / magazine. 카드 탭 시 focusedId 풀뷰.
  //   게시판별 override(104+) 가 있으면 우선, 없으면 프로그램 전체 레이아웃.
  const layout = layoutProp || program.community_layout || 'feed'
  const showFull = layout === 'feed' || !!focusedId
  const visiblePosts = focusedId ? posts.filter(p => p.id === focusedId) : posts

  // 리스트형 — 썸네일(좌) + 텍스트(우), 균일 가로 행
  const renderListRow = (post) => {
    const img = imageUrls[post.id]
    const note = post.note?.trim()
    return (
      <button key={post.id} type="button" onClick={() => setFocusedId(post.id)}
        className="w-full flex items-center gap-3 text-left bg-white border border-gray-200 rounded-2xl p-2.5 hover:shadow-md transition">
        {post.image_path ? (
          <div className="w-[64px] h-[64px] rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
            {img ? <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300">🖼️</div>}
          </div>
        ) : (
          <div className="w-[64px] h-[64px] rounded-xl bg-emerald-50 flex-shrink-0 flex items-center justify-center text-emerald-300 text-xl">📝</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-gray-800 truncate">{post.user?.nickname || '익명'}</span>
            <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{formatRelativeKstDay(post.submitted_at)}</span>
          </div>
          {note && <p className="text-[12px] text-gray-600 line-clamp-1 mt-0.5">{note}</p>}
          {reactionsEnabled && (
          <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
            <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {post.likedUserIds.size}</span>
            <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" /> {post.commentCount}</span>
          </div>
          )}
        </div>
      </button>
    )
  }

  // 그리드형 컴팩트 카드 — 이미지 위 / 텍스트 아래
  const renderGridCard = (post) => {
    const img = imageUrls[post.id]
    const note = post.note?.trim()
    return (
      <button key={post.id} type="button" onClick={() => setFocusedId(post.id)}
        className="flex flex-col text-left bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition">
        {post.image_path && (
          <div className="aspect-square bg-gray-100">
            {img ? <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">🖼️</div>}
          </div>
        )}
        <div className="p-2.5 flex-1 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <UserAvatar avatarPath={post.user?.avatar_path} nickname={post.user?.nickname} size="sm" />
            <span className="text-[11px] font-medium text-gray-700 truncate">{post.user?.nickname || '익명'}</span>
          </div>
          {note && <p className="text-[12px] text-gray-700 line-clamp-2">{note}</p>}
          {reactionsEnabled && (
          <div className="flex items-center gap-3 mt-auto pt-1 text-[11px] text-gray-500">
            <span className="flex items-center gap-0.5"><Heart className="w-3.5 h-3.5" /> {post.likedUserIds.size}</span>
            <span className="flex items-center gap-0.5"><MessageCircle className="w-3.5 h-3.5" /> {post.commentCount}</span>
          </div>
          )}
        </div>
      </button>
    )
  }

  // 매거진형 카드 — 이미지 위 텍스트 오버레이 (hero=대형)
  const renderMagCard = (post, hero) => {
    const img = imageUrls[post.id]
    const note = post.note?.trim()
    return (
      <button key={post.id} type="button" onClick={() => setFocusedId(post.id)}
        className={`relative block text-left w-full rounded-2xl overflow-hidden bg-gray-200 ${hero ? 'aspect-[16/9]' : 'aspect-[4/3]'}`}>
        {img ? <img src={img} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 bg-gradient-to-br from-emerald-300 to-teal-400" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
          {note && <p className={`font-bold drop-shadow line-clamp-2 ${hero ? 'text-[15px]' : 'text-[12px]'}`}>{note}</p>}
          <div className="flex items-center gap-2 mt-1 text-[11px]">
            <span className="truncate">{post.user?.nickname || '익명'}</span>
            {reactionsEnabled && (
            <span className="ml-auto flex items-center gap-2 flex-shrink-0">
              <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {post.likedUserIds.size}</span>
              <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" /> {post.commentCount}</span>
            </span>
            )}
          </div>
        </div>
      </button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {layout === 'list' && (
        <div className="space-y-2">{posts.map(renderListRow)}</div>
      )}
      {layout === 'grid' && (
        <div className="grid grid-cols-2 gap-3">{posts.map(renderGridCard)}</div>
      )}
      {layout === 'magazine' && (() => {
        // 사진 있는 인증: 대1(hero) + 소2(그리드). 글만 있는 인증(사진 X)은 중(가로)로.
        const imgQ = posts.filter(p => p.image_path)
        const txtQ = posts.filter(p => !p.image_path)
        const blocks = []
        let k = 0
        while (imgQ.length) {
          blocks.push(<div key={`big-${k}`}>{renderMagCard(imgQ.shift(), true)}</div>)
          const smalls = [imgQ.shift(), imgQ.shift()].filter(Boolean)
          if (smalls.length) blocks.push(<div key={`sm-${k}`} className="grid grid-cols-2 gap-3">{smalls.map(p => renderMagCard(p, false))}</div>)
          if (txtQ.length) blocks.push(<div key={`md-${k}`}>{renderListRow(txtQ.shift())}</div>)
          k++
        }
        // 남은 글만 있는 인증은 모두 중(가로)
        if (txtQ.length) blocks.push(<div key="rest" className="space-y-3">{txtQ.map(p => renderListRow(p))}</div>)
        return <div className="space-y-3">{blocks}</div>
      })()}
      {showFull && (
        <div className={focusedId && layout !== 'feed' ? 'fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-5' : ''}
          style={focusedId && layout !== 'feed' ? { touchAction: 'pan-y' } : undefined}
          onClick={focusedId && layout !== 'feed' ? () => setFocusedId(null) : undefined}>
        <div className={focusedId && layout !== 'feed' ? 'w-full max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden overscroll-contain space-y-5' : 'space-y-5'}
          style={focusedId && layout !== 'feed' ? { touchAction: 'pan-y' } : undefined}
          onClick={focusedId && layout !== 'feed' ? (e) => e.stopPropagation() : undefined}>
      {visiblePosts.map(post => {
        const likedByMe = post.likedUserIds.has(myUserId)
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
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-[11px] text-gray-400 whitespace-nowrap pt-0.5">
                  {formatRelativeKstDay(post.submitted_at)}
                </span>
                {canEditNote && !isEditingNote && (
                  <button
                    type="button"
                    onClick={() => startEditNote(post)}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                    title="소감 수정"
                  >
                    <Pencil className="w-3 h-3" />
                    수정
                  </button>
                )}
                {!isMyPost && !readOnly && (
                  <button
                    type="button"
                    onClick={() => setReportVid(post.id)}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                    title="신고"
                  >
                    <Flag className="w-3 h-3" />
                    신고
                  </button>
                )}
              </div>
            </div>

            {/* 사진 (있으면) */}
            {hasImage && (
              <div className="bg-gray-50">
                {imageUrls[post.id] ? (
                  <img
                    src={imageUrls[post.id]}
                    alt="인증 사진"
                    loading="lazy"
                    decoding="async"
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

            {/* 숫자/소감 (있으면). 수정 버튼은 헤더(날짜 아래)로 이동 */}
            {(hasNumeric || hasNote || isEditingNote) && (
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
                  hasNote && (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                      {post.note}
                    </p>
                  )
                )}
              </div>
            )}

            {/* 좋아요 + 댓글 토글 + 운영자 액션 — 반응 비활성 + 비운영자면 바 숨김 */}
            {(reactionsEnabled || isProgramOwner) && (
            <div className="flex items-center gap-3 px-4 pt-3 pb-1">
              {reactionsEnabled && (<>
              <button
                type="button"
                onClick={() => { if (!readOnly) toggleLikeMutation.mutate({ verificationId: post.id, isLiked: likedByMe }) }}
                disabled={toggleLikeMutation.isPending || readOnly}
                className="flex items-center gap-1 text-sm transition disabled:opacity-100 disabled:cursor-default"
              >
                <Heart className={`w-5 h-5 ${likedByMe ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                <span className={likedByMe ? 'text-red-500 font-medium' : 'text-gray-600'}>
                  {post.likeCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => toggleComments(post.id)}
                className={`flex items-center gap-1 text-sm transition ${openComments.has(post.id) ? 'text-emerald-600' : 'text-gray-600 hover:text-gray-800'}`}
              >
                <MessageCircle className="w-5 h-5" />
                <span>{post.commentCount}</span>
              </button>
              </>)}

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
            )}

            {/* 댓글 — 아이콘 클릭 시 그 게시물 댓글을 lazy 로드 + 입력 */}
            {reactionsEnabled && openComments.has(post.id) && (
              <CommentsSection
                verificationId={post.id}
                programId={id}
                myUserId={myUserId}
                isProgramOwner={isProgramOwner}
                targetCommentId={targetCommentId}
                readOnly={readOnly}
              />
            )}

            {/* 날짜 */}
            <p className="px-4 pb-3 text-xs text-gray-400 uppercase">
              {formatKstDate(new Date(post.submitted_at))}
            </p>
          </article>
        )
      })}
        </div>
        </div>
      )}

      {/* 더보기 — 다음 페이지 있을 때만 (포커스 풀뷰에선 숨김) */}
      {hasNextPage && !focusedId && (
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
      <ReportModal
        isOpen={reportVid != null}
        onClose={() => setReportVid(null)}
        programId={id}
        targetType="verification"
        targetId={reportVid}
        onReported={() => queryClient.invalidateQueries({ queryKey: queryKeys.feedPosts(id) })}
      />
    </motion.div>
  )
}

// 긴 댓글 line-clamp-2 + "더 보기" 판단
const isLongComment = (content) => !!content && (content.length > 60 || content.includes('\n'))

// 한 게시물의 댓글 — 펼칠 때만 마운트되어 그 게시물 댓글을 lazy fetch + 입력.
//   댓글 추가/삭제 시 자기 쿼리 + 피드(댓글 수) 무효화. 알림 ?c= 딥링크는 자체 스크롤·하이라이트.
function CommentsSection({ verificationId, programId, myUserId, isProgramOwner, targetCommentId, readOnly = false }) {
  const queryClient = useQueryClient()
  const [input, setInput] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [highlight, setHighlight] = useState(null)
  const [editingId, setEditingId] = useState(null)   // 수정 중인 댓글 id
  const [editText, setEditText] = useState('')
  const refs = useRef({})
  const toggleExpanded = (cid) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(cid)) next.delete(cid)
    else next.add(cid)
    return next
  })

  const { data: comments = [], isLoading } = useQuery({
    queryKey: queryKeys.postComments(verificationId),
    queryFn: () => fetchPostComments(verificationId),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.postComments(verificationId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.feedPosts(programId) })  // 댓글 수 갱신
  }
  const addMutation = useMutation({
    mutationFn: async (content) => {
      const { error } = await supabase.from('post_comments')
        .insert({ verification_id: verificationId, user_id: myUserId, content: content.trim() })
      if (error) throw error
    },
    onSuccess: () => { setInput(''); invalidate() },
    onError: (err) => alert(`댓글 작성에 실패했습니다: ${err.message}`),
  })
  const deleteMutation = useMutation({
    mutationFn: async (commentId) => {
      const { error } = await supabase.from('post_comments').delete().eq('id', commentId)
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: (err) => alert(`댓글 삭제에 실패했습니다: ${err.message}`),
  })
  const updateMutation = useMutation({
    mutationFn: async ({ commentId, content }) => {
      const { error } = await supabase.from('post_comments')
        .update({ content: content.trim(), updated_at: new Date().toISOString() })
        .eq('id', commentId)
      if (error) throw error
    },
    onSuccess: () => { setEditingId(null); setEditText(''); invalidate() },
    onError: (err) => alert(`댓글 수정에 실패했습니다: ${err.message}`),
  })
  const submit = () => { const c = input.trim(); if (c) addMutation.mutate(c) }
  const handleDelete = (cid) => { if (window.confirm('이 댓글을 삭제할까요?')) deleteMutation.mutate(cid) }
  const startEdit = (c) => { setEditingId(c.id); setEditText(c.content) }
  const cancelEdit = () => { setEditingId(null); setEditText('') }
  const saveEdit = (cid) => { const c = editText.trim(); if (c) updateMutation.mutate({ commentId: cid, content: c }) }

  // 알림 ?c= 딥링크 — 해당 댓글로 스크롤 + 하이라이트
  useEffect(() => {
    if (!targetCommentId || comments.length === 0) return
    if (!comments.some(c => c.id === targetCommentId)) return
    const el = refs.current[targetCommentId]
    if (!el) return
    const t = setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlight(targetCommentId)
      setTimeout(() => setHighlight(null), 2500)
    }, 250)
    return () => clearTimeout(t)
  }, [comments, targetCommentId])

  return (
    <div className="border-t border-gray-100">
      {isLoading ? (
        <p className="px-4 py-3 text-xs text-gray-400">댓글 불러오는 중...</p>
      ) : comments.length === 0 ? (
        <p className="px-4 py-3 text-xs text-gray-400">아직 댓글이 없어요. 첫 댓글을 남겨보세요!</p>
      ) : (
        <div className="px-4 pt-3 space-y-1.5">
          {comments.map(c => {
            const isMine = c.user_id === myUserId
            const canDelete = isMine || isProgramOwner
            const isLong = isLongComment(c.content)
            const clamped = isLong && !expanded.has(c.id)
            const isHi = highlight === c.id
            const isEditing = editingId === c.id
            const isEdited = c.updated_at && c.created_at && new Date(c.updated_at) - new Date(c.created_at) > 1000
            return (
              <div
                key={c.id}
                ref={(el) => { refs.current[c.id] = el }}
                className={`flex items-start gap-2 text-sm rounded-lg p-1.5 -mx-1.5 transition-all duration-500 ${isHi ? 'bg-amber-100 ring-2 ring-amber-300' : ''}`}
              >
                <UserAvatar avatarPath={c.user?.avatar_path} nickname={c.user?.nickname} size="sm" className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(c.id) }
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        maxLength={200}
                        autoFocus
                        disabled={updateMutation.isPending}
                        className="flex-1 min-w-0 px-2.5 py-1 text-sm bg-white rounded-full border border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-50"
                      />
                      <button type="button" onClick={() => saveEdit(c.id)} disabled={updateMutation.isPending || !editText.trim()}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex-shrink-0 disabled:opacity-40">저장</button>
                      <button type="button" onClick={cancelEdit}
                        className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">취소</button>
                    </div>
                  ) : (
                    <>
                      <p className={`break-words ${clamped ? 'line-clamp-2' : ''}`}>
                        <span className="font-medium text-gray-800">{c.user?.nickname || '(?)'}</span>{' '}
                        <span className="text-gray-700 whitespace-pre-wrap">{c.content}</span>
                        {isEdited && <span className="text-[11px] text-gray-400 ml-1">(수정됨)</span>}
                      </p>
                      {isLong && (
                        <button type="button" onClick={() => toggleExpanded(c.id)} className="text-xs text-gray-400 hover:text-gray-600 mt-0.5">
                          {expanded.has(c.id) ? '접기' : '... 더 보기'}
                        </button>
                      )}
                    </>
                  )}
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isMine && (
                      <button type="button" onClick={() => startEdit(c)}
                        className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition" title="댓글 수정">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button type="button" onClick={() => handleDelete(c.id)} disabled={deleteMutation.isPending}
                        className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-full transition disabled:opacity-40" title="댓글 삭제">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 댓글 입력 — 열람 모드(비참여자)에서는 안내로 대체 */}
      {readOnly ? (
        <p className="px-4 py-3 text-xs text-gray-400 text-center">참여하면 댓글을 남길 수 있어요</p>
      ) : (
      <div className="flex items-center gap-2 px-4 py-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          placeholder="댓글 달기..."
          maxLength={200}
          disabled={addMutation.isPending}
          className="flex-1 px-3 py-1.5 text-sm bg-gray-50 rounded-full focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-400 disabled:opacity-50"
        />
        <button type="button" onClick={submit} disabled={addMutation.isPending || !input.trim()}
          className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-full transition disabled:opacity-40" title="댓글 작성">
          <Send className="w-4 h-4" />
        </button>
      </div>
      )}
    </div>
  )
}

export default FeedContent
