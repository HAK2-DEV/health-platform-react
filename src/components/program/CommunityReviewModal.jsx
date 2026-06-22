import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Clock, Check } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { setCommunityPostStatus, rejectCommunityPost, queryKeys } from '../../lib/queries'
import { formatRelativeKstDay } from '../../lib/formatters'
import UserAvatar from '../common/UserAvatar'
import RejectReasonModal from './RejectReasonModal'

// 운영자 통합 검토함 — 검토 대기(pending) 글을 「한 건씩」 (제목·내용·사진 전체) 보고 승인/거절.
//   대기열 방식: 항상 posts[0] 을 보여주고, 처리하면 그 글이 빠져 다음 글이 올라옴.
function CommunityReviewModal({ isOpen, onClose, programId, posts = [], boards = [] }) {
  const qc = useQueryClient()
  const [imageUrl, setImageUrl] = useState(null)
  const [rejectOpen, setRejectOpen] = useState(false)   // 거절 사유 입력 모달
  const current = posts[0] || null

  // 열려 있는 동안 뒤 화면(body) 스크롤 잠금
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  // 현재 글의 사진 signed URL (한 건씩이라 1개만 요청)
  useEffect(() => {
    let cancelled = false
    setImageUrl(null)
    if (!current?.image_path) return
    supabase.storage.from('community-posts').createSignedUrl(current.image_path, 3600)
      .then(({ data }) => { if (!cancelled) setImageUrl(data?.signedUrl || null) })
    return () => { cancelled = true }
  }, [current?.id, current?.image_path])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.communityPending(programId) })
    qc.invalidateQueries({ queryKey: ['community-posts', programId] })   // 모든 보드 목록 (prefix)
  }
  const approveMut = useMutation({
    mutationFn: (id) => setCommunityPostStatus({ id, status: 'visible' }),
    onSuccess: invalidate,
    onError: (e) => alert(`승인 실패: ${e.message}`),
  })
  const rejectMut = useMutation({
    mutationFn: ({ id, reason }) => rejectCommunityPost({ id, reason }),
    onSuccess: () => { invalidate(); setRejectOpen(false) },
    onError: (e) => alert(`거절 실패: ${e.message}`),
  })
  const busy = approveMut.isPending || rejectMut.isPending
  const boardName = (id) => boards.find(b => b.id === id)?.name || id

  if (!isOpen) return null
  return (
    <>
    <div className="fixed inset-0 z-[75] bg-black/40 flex items-center justify-center p-5" onClick={onClose}>
      <div className="w-full max-w-md max-h-[88vh] flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 — 남은 건수 */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
          <Clock className="w-5 h-5 text-amber-500" />
          <h2 className="text-[16px] font-bold text-gray-800">검토 대기 글</h2>
          {posts.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-bold">{posts.length}</span>
          )}
          <button type="button" onClick={onClose} className="ml-auto p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        {current ? (
          <>
            {/* 본문 — 한 건 전체(제목·내용·사진). 글이 길면 이 영역만 스크롤 */}
            <div className="flex-1 overflow-y-auto p-5" style={{ touchAction: 'pan-y' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[11px] font-bold flex-shrink-0">{boardName(current.board_id)}</span>
                <UserAvatar avatarPath={current.author?.avatar_path} nickname={current.author?.nickname} size="sm" />
                <span className="text-[13px] font-semibold text-gray-700 truncate">{current.author?.nickname || '익명'}</span>
                <span className="text-[11px] text-gray-400 ml-auto flex-shrink-0">{formatRelativeKstDay(current.created_at)}</span>
              </div>
              {current.title && <h3 className="text-lg font-bold text-gray-800 mb-1.5 break-words">{current.title}</h3>}
              {current.body && <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">{current.body}</p>}
              {current.image_path && (
                imageUrl
                  ? <img src={imageUrl} alt="" className="mt-3 w-full max-h-[46vh] object-contain rounded-lg bg-gray-50" />
                  : <div className="mt-3 h-40 rounded-lg bg-gray-100 animate-pulse" />
              )}
            </div>

            {/* 승인/거절 — 고정 푸터 */}
            <div className="flex items-center gap-2.5 p-4 border-t border-gray-100 flex-shrink-0">
              <button type="button" onClick={() => setRejectOpen(true)} disabled={busy}
                className="px-5 h-12 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:bg-gray-50 transition disabled:opacity-50">거절</button>
              <button type="button" onClick={() => approveMut.mutate(current.id)} disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition disabled:opacity-50">
                <Check className="w-4 h-4" strokeWidth={3} /> {busy ? '처리 중...' : '승인'}
              </button>
            </div>
          </>
        ) : (
          // 모두 처리 완료
          <div className="py-16 px-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <Check className="w-7 h-7 text-emerald-500" strokeWidth={2.5} />
            </div>
            <p className="text-[15px] font-bold text-gray-800">검토를 모두 마쳤어요!</p>
            <p className="text-[13px] text-gray-500 mt-1">대기 중인 글이 없어요.</p>
            <button type="button" onClick={onClose} className="mt-5 px-6 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition">닫기</button>
          </div>
        )}
      </div>
    </div>
    {/* 거절 사유 입력 */}
    <RejectReasonModal
      isOpen={rejectOpen && !!current}
      onClose={() => setRejectOpen(false)}
      onSubmit={(reason) => current && rejectMut.mutate({ id: current.id, reason })}
      busy={rejectMut.isPending}
      postLabel={current?.title || current?.body?.slice(0, 20)}
    />
    </>
  )
}

export default CommunityReviewModal
