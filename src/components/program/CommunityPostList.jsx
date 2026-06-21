import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Pencil, Flag, Pin, PinOff } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { deleteCommunityPost, setCommunityPostPin, queryKeys } from '../../lib/queries'
import { formatRelativeKstDay } from '../../lib/formatters'
import UserAvatar from '../common/UserAvatar'
import EmptyState from '../common/EmptyState'
import ReportModal from '../common/ReportModal'
import ConfirmModal from '../common/ConfirmModal'
import CommunityPostSocial from './CommunityPostSocial'

// 게시판 글 목록 — 작성자/내용/이미지(signed URL) + 본인·운영자 삭제·고정.
//   layout: feed(기본 카드) / list(가로 행) / grid(2열) / magazine(대1+소2+중1 반복).
//   - 이미지 없는 글은 이미지 자리 대신 프로필+텍스트 카드. 매거진에선 중(가로) 우선 배치.
//   - 카드 탭 시 상세 모달(글 펼치기).
function CommunityPostList({ programId, boardId, posts = [], myUserId, isOwner, onEdit, layout = 'feed', canReact = false, canComment = false }) {
  const queryClient = useQueryClient()
  const [imageUrls, setImageUrls] = useState({})
  const [reportId, setReportId] = useState(null)
  const [detailPost, setDetailPost] = useState(null)   // 상세(글 펼치기) 모달
  const [postToDelete, setPostToDelete] = useState(null)  // 삭제 확인 모달
  // image_path → signedUrl 캐시 (세션 내). 칩 전환 시 이미 본 이미지는 재요청 X → 누락분만 fetch.
  const urlCacheRef = useRef({})

  useEffect(() => {
    let cancelled = false
    const withImg = posts.filter(p => p.image_path)
    if (withImg.length === 0) { setImageUrls({}); return }
    const cache = urlCacheRef.current
    const buildMap = () => {
      const map = {}
      for (const p of withImg) { const u = cache[p.image_path]; if (u) map[p.id] = u }
      return map
    }
    // 캐시된 건 즉시 반영(이미지 빈칸 방지) → 누락 경로만 네트워크로
    setImageUrls(buildMap())
    const missing = [...new Set(withImg.map(p => p.image_path).filter(path => !cache[path]))]
    if (missing.length === 0) return
    supabase.storage.from('community-posts').createSignedUrls(missing, 3600)
      .then(({ data }) => {
        if (cancelled) return
        for (const r of data || []) {
          if (r.path && r.signedUrl && !r.error) cache[r.path] = r.signedUrl
        }
        setImageUrls(buildMap())
      })
    return () => { cancelled = true }
  }, [posts])

  const delMutation = useMutation({
    mutationFn: (id) => deleteCommunityPost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communityPosts(programId, boardId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.communityPosts(programId, 'all') })
      setDetailPost(null)
      setPostToDelete(null)
    },
    onError: (e) => alert(`삭제 실패: ${e.message}`),
  })
  const onDelete = (p) => setPostToDelete(p)

  // 상단 고정/해제 — 운영자 전용 (공지 게시판). DB 트리거가 owner 외 변경을 차단.
  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }) => setCommunityPostPin({ id, pinned, programId, boardId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communityPosts(programId, boardId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.communityPosts(programId, 'all') })
    },
    onError: (e) => alert(`고정 변경 실패: ${e.message}`),
  })
  const canPin = isOwner && boardId === 'notice'
  const hasImg = (p) => !!p.image_path

  // 공통 액션 (핀/신고/수정/삭제). light=오버레이(흰 아이콘). 카드 클릭(상세)과 분리 위해 stopPropagation.
  const Actions = ({ p, light = false }) => {
    const isPinned = !!p.pinned_at
    const canDelete = p.author_id === myUserId || isOwner
    const lc = light ? 'text-white/85 hover:text-white' : ''
    return (
      <div onClick={(e) => e.stopPropagation()}
        className={`flex items-center gap-0.5 flex-shrink-0 ${light ? 'bg-black/25 rounded-full px-0.5 backdrop-blur-sm' : ''}`}>
        {canPin && (
          <button type="button" onClick={() => pinMutation.mutate({ id: p.id, pinned: !isPinned })} disabled={pinMutation.isPending}
            className={`p-1 transition disabled:opacity-50 ${light ? lc : (isPinned ? 'text-emerald-600 hover:text-gray-400' : 'text-gray-400 hover:text-emerald-600')}`}
            title={isPinned ? '고정 해제' : '상단 고정'}>
            {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
          </button>
        )}
        {p.author_id !== myUserId && boardId !== 'notice' && (
          <button type="button" onClick={() => setReportId(p.id)}
            className={`p-1 transition ${light ? lc : 'text-gray-400 hover:text-amber-600'}`} title="신고"><Flag className="w-4 h-4" /></button>
        )}
        {p.author_id === myUserId && onEdit && (
          <button type="button" onClick={() => onEdit(p)}
            className={`p-1 transition ${light ? lc : 'text-gray-400 hover:text-emerald-600'}`} title="수정"><Pencil className="w-4 h-4" /></button>
        )}
        {canDelete && (
          <button type="button" onClick={() => onDelete(p)} disabled={delMutation.isPending}
            className={`p-1 transition disabled:opacity-50 ${light ? lc : 'text-gray-400 hover:text-red-500'}`} title="삭제"><Trash2 className="w-4 h-4" /></button>
        )}
      </div>
    )
  }

  const PinPill = ({ floating }) => (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold ${floating ? 'absolute top-2 left-2 z-10' : ''}`}>
      <Pin className="w-2.5 h-2.5 fill-current" /> 고정
    </span>
  )
  const pinnedRing = (p) => p.pinned_at ? 'ring-2 ring-emerald-400' : ''

  // ── feed (기본형) — 풀 카드 (본문 전체) ───────────────────
  const renderFeed = (p) => (
    <article key={p.id} className={`rounded-2xl p-4 transition ${p.pinned_at ? 'border-2 border-emerald-400 ring-2 ring-emerald-100 bg-emerald-50/40 shadow-sm' : 'bg-white border border-gray-200'}`}>
      {p.pinned_at && <div className="mb-2"><PinPill /></div>}
      <div className="flex items-center gap-2.5 mb-2">
        <UserAvatar avatarPath={p.author?.avatar_path} nickname={p.author?.nickname} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-800 truncate">{p.author?.nickname || '익명'}</p>
          <p className="text-[11px] text-gray-400">
            {formatRelativeKstDay(p.created_at)}
            {p.status === 'pending' && <span className="ml-1 text-amber-600 font-medium">· 검토 대기</span>}
          </p>
        </div>
        <Actions p={p} />
      </div>
      {p.title && <h3 className="font-bold text-gray-800 mb-1">{p.title}</h3>}
      {p.body && <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{p.body}</p>}
      {p.image_path && imageUrls[p.id] && (
        <img src={imageUrls[p.id]} alt="" loading="lazy" className="mt-2 w-full max-h-[400px] object-contain rounded-lg bg-gray-50" />
      )}
    </article>
  )

  // 작성자 한 줄 (아바타 + 닉네임) — 오버레이/카드 공용
  const AuthorRow = ({ p, light }) => (
    <div className={`flex items-center gap-1.5 ${light ? 'text-white' : 'text-gray-600'}`}>
      <UserAvatar avatarPath={p.author?.avatar_path} nickname={p.author?.nickname} size="sm" />
      <span className="text-[11px] font-semibold truncate">{p.author?.nickname || '익명'}</span>
      {p.status === 'pending' && <span className={`text-[10px] font-medium flex-shrink-0 ${light ? 'text-amber-300' : 'text-amber-600'}`}>· 검토 대기</span>}
    </div>
  )

  // ── 이미지 글 — 대형 hero (오버레이) ──────────────────────
  const renderImgBig = (p) => (
    <article key={p.id} onClick={() => setDetailPost(p)} className={`relative rounded-2xl overflow-hidden aspect-[16/9] cursor-pointer ${pinnedRing(p)}`}>
      <img src={imageUrls[p.id]} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover bg-gray-200" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
      {p.pinned_at && <PinPill floating />}
      <div className="absolute top-1.5 right-1.5"><Actions p={p} light /></div>
      <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
        {p.title && <p className="text-[15px] font-bold drop-shadow line-clamp-1">{p.title}</p>}
        {p.body && <p className="text-[12px] drop-shadow line-clamp-2 mt-0.5 leading-snug">{p.body}</p>}
        <div className="mt-1.5"><AuthorRow p={p} light /></div>
      </div>
    </article>
  )

  // ── 이미지 없는 글 — 흰 배경 + 제목/내용 카드. big=대형 비율 ──
  const renderTextCard = (p, big) => (
    <article key={p.id} onClick={() => setDetailPost(p)}
      className={`rounded-2xl overflow-hidden cursor-pointer p-3 flex flex-col ${big ? 'aspect-[16/9]' : 'h-44'} ${p.pinned_at ? 'border-2 border-emerald-400 ring-2 ring-emerald-100 bg-emerald-50/40' : 'bg-white border border-gray-200'}`}>
      {p.pinned_at && <div className="mb-1"><PinPill /></div>}
      <div className="flex items-start gap-2">
        <p className={`flex-1 font-bold text-gray-800 line-clamp-1 ${big ? 'text-[15px]' : 'text-[13px]'}`}>{p.title || p.author?.nickname || '익명'}</p>
        <Actions p={p} />
      </div>
      {p.body && <p className={`text-gray-600 mt-1 leading-snug ${big ? 'text-[13px] line-clamp-3' : 'text-[12px] line-clamp-4'}`}>{p.body}</p>}
      <div className="mt-auto pt-2"><AuthorRow p={p} /></div>
    </article>
  )

  // ── 이미지 글 — 소형 그리드 카드 (이미지 위 / 텍스트 아래) ──
  const renderImgGrid = (p) => (
    <article key={p.id} onClick={() => setDetailPost(p)} className={`relative rounded-2xl overflow-hidden cursor-pointer bg-white border border-gray-200 ${pinnedRing(p)}`}>
      {p.pinned_at && <PinPill floating />}
      <img src={imageUrls[p.id]} alt="" loading="lazy" className="w-full h-28 object-cover bg-gray-100" />
      <div className="p-2.5">
        {p.title && <p className="text-[13px] font-bold text-gray-800 truncate">{p.title}</p>}
        {p.body && <p className="text-[11px] text-gray-600 line-clamp-2 leading-snug mt-0.5">{p.body}</p>}
        <div className="flex items-center justify-between gap-1 mt-1.5">
          <AuthorRow p={p} />
          <Actions p={p} />
        </div>
      </div>
    </article>
  )

  // 대/소 슬롯 — 이미지 유무로 분기
  const renderBig = (p) => hasImg(p) ? renderImgBig(p) : renderTextCard(p, true)
  const renderSmall = (p) => hasImg(p) ? renderImgGrid(p) : renderTextCard(p, false)

  // ── 중(가로 행) — 좌측 썸네일(이미지) 또는 프로필 + 텍스트 ──
  const renderMid = (p) => (
    <article key={p.id} onClick={() => setDetailPost(p)} className={`flex gap-3 items-start p-3 rounded-2xl cursor-pointer ${p.pinned_at ? 'border-2 border-emerald-400 ring-2 ring-emerald-100 bg-emerald-50/40' : 'bg-white border border-gray-200'}`}>
      {hasImg(p) ? (
        <img src={imageUrls[p.id]} alt="" loading="lazy" className="w-16 h-16 rounded-xl object-cover bg-gray-100 flex-shrink-0" />
      ) : (
        <UserAvatar avatarPath={p.author?.avatar_path} nickname={p.author?.nickname} size="lg" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-gray-800 truncate">{p.author?.nickname || '익명'}</span>
            <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelativeKstDay(p.created_at)}</span>
            {p.status === 'pending' && <span className="text-[10px] text-amber-600 font-medium flex-shrink-0">· 검토 대기</span>}
          </div>
          <Actions p={p} />
        </div>
        {p.pinned_at && <span className="inline-flex items-center gap-0.5 mt-0.5 text-[10px] font-bold text-emerald-600"><Pin className="w-3 h-3 fill-current" /> 고정</span>}
        {p.title && <p className="text-[13px] font-bold text-gray-800 truncate mt-0.5">{p.title}</p>}
        {p.body && <p className="text-[12px] text-gray-600 line-clamp-2 leading-snug mt-0.5">{p.body}</p>}
      </div>
    </article>
  )

  // 매거진 — 이미지 글만 대/소(대1+소2 반복), 글만 있는 게시글은 전부 중(가로).
  //   고정 글은 맨 앞 대형(이미지=hero / 글만=흰 배경 카드).
  const buildMagazine = () => {
    const list = [...posts]
    const blocks = []
    let lead = null
    if (list[0]?.pinned_at) lead = list.shift()
    const imgQ = list.filter(hasImg)
    const txtQ = list.filter(p => !hasImg(p))
    if (lead) blocks.push(<div key="lead">{renderBig(lead)}</div>)
    let k = 0
    // 이미지 글로 대1 + 소2 반복, 사이사이 글만 있는 게시글 1개를 중으로
    while (imgQ.length) {
      blocks.push(<div key={`b${k}`}>{renderImgBig(imgQ.shift())}</div>)
      const smalls = [imgQ.shift(), imgQ.shift()].filter(Boolean)
      if (smalls.length) blocks.push(<div key={`s${k}`} className="grid grid-cols-2 gap-3">{smalls.map(renderImgGrid)}</div>)
      if (txtQ.length) blocks.push(<div key={`m${k}`}>{renderMid(txtQ.shift())}</div>)
      k++
    }
    // 남은 글만 있는 게시글은 모두 중(가로)
    if (txtQ.length) blocks.push(<div key="rest" className="space-y-2.5">{txtQ.map(renderMid)}</div>)
    return <div className="space-y-3">{blocks}</div>
  }

  if (posts.length === 0) {
    return <EmptyState icon="📝" title="아직 글이 없어요" description="첫 글을 남겨보세요" />
  }

  return (
    <>
      {layout === 'feed' && <div className="space-y-3">{posts.map(renderFeed)}</div>}
      {layout === 'list' && <div className="space-y-2.5">{posts.map(renderMid)}</div>}
      {layout === 'grid' && <div className="grid grid-cols-2 gap-3">{posts.map(renderSmall)}</div>}
      {layout === 'magazine' && buildMagazine()}

      {/* 상세(글 펼치기) — 화면 중앙 카드 (삭제 확인과 동일 스타일) */}
      {detailPost && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-5" style={{ touchAction: 'pan-y' }} onClick={() => setDetailPost(null)}>
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden overscroll-contain bg-white rounded-2xl p-5 shadow-xl" style={{ touchAction: 'pan-y' }} onClick={(e) => e.stopPropagation()}>
            {detailPost.pinned_at && <div className="mb-2"><PinPill /></div>}
            <div className="flex items-center gap-2.5 mb-3">
              <UserAvatar avatarPath={detailPost.author?.avatar_path} nickname={detailPost.author?.nickname} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-800 truncate">{detailPost.author?.nickname || '익명'}</p>
                <p className="text-[11px] text-gray-400">
                  {formatRelativeKstDay(detailPost.created_at)}
                  {detailPost.status === 'pending' && <span className="ml-1 text-amber-600 font-medium">· 검토 대기</span>}
                </p>
              </div>
              <Actions p={detailPost} />
            </div>
            {detailPost.title && <h3 className="font-bold text-lg text-gray-800 mb-1.5">{detailPost.title}</h3>}
            {detailPost.body && <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">{detailPost.body}</p>}
            {detailPost.image_path && imageUrls[detailPost.id] && (
              <img src={imageUrls[detailPost.id]} alt="" className="mt-3 w-full max-h-[60vh] object-contain rounded-lg bg-gray-50" />
            )}
            {/* 좋아요 · 댓글 — 반응 허용 + 참여자/운영자일 때 */}
            {canReact && detailPost.status !== 'pending' && (
              <CommunityPostSocial
                postId={detailPost.id}
                programId={programId}
                myUserId={myUserId}
                isOwner={isOwner}
                canReact={canReact}
                canComment={canComment}
              />
            )}
          </div>
        </div>
      )}

      <ReportModal
        isOpen={reportId != null}
        onClose={() => setReportId(null)}
        programId={programId}
        targetType="post"
        targetId={reportId}
      />

      {/* 게시글 삭제 확인 */}
      <ConfirmModal
        isOpen={postToDelete != null}
        onClose={() => setPostToDelete(null)}
        onConfirm={() => delMutation.mutate(postToDelete.id)}
        title="이 글을 삭제할까요?"
        message={postToDelete ? `${postToDelete.title ? `"${postToDelete.title}" ` : ''}글을 삭제하면 되돌릴 수 없어요.` : ''}
        confirmLabel="삭제"
        danger
        busy={delMutation.isPending}
      />
    </>
  )
}

export default CommunityPostList
