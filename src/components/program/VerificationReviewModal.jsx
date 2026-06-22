import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, ClipboardCheck, Check, Flag } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { approveVerification, rejectVerification, queryKeys } from '../../lib/queries'
import { formatRelativeKstDay } from '../../lib/formatters'
import UserAvatar from '../common/UserAvatar'
import RejectReasonModal from './RejectReasonModal'

// 운영자 인증 검토 큐 — 검토 필요(PENDING_REVIEW) 인증을 「한 건씩」(사진·기록·소감 + 미션·참가자)
//   보고 승인/거절(사유 입력). 대기열: 항상 reviews[0], 처리하면 빠지며 다음으로.
//   거절은 인증을 삭제하지 않고 REJECTED + 사유 기록(점수 제외) → 기존 트리거가 제출자에게 결과 알림.
function VerificationReviewModal({ isOpen, onClose, programId, reviews = [], reviewerId }) {
  const qc = useQueryClient()
  const [imageUrl, setImageUrl] = useState(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const current = reviews[0] || null

  // 배경 스크롤 잠금
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  // 현재 인증 사진 signed URL
  useEffect(() => {
    let cancelled = false
    setImageUrl(null)
    if (!current?.v_image_path) return
    supabase.storage.from('verification-images').createSignedUrl(current.v_image_path, 3600)
      .then(({ data }) => { if (!cancelled) setImageUrl(data?.signedUrl || null) })
    return () => { cancelled = true }
  }, [current?.v_id, current?.v_image_path])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.pendingReviews(programId) })
    qc.invalidateQueries({ queryKey: ['verifications'] })
    qc.invalidateQueries({ queryKey: ['scores'] })
    qc.invalidateQueries({ queryKey: ['rankings'] })
    qc.invalidateQueries({ queryKey: ['stats'] })
  }
  const approveMut = useMutation({
    mutationFn: (id) => approveVerification({ id, reviewerId }),
    onSuccess: invalidate,
    onError: (e) => alert(`승인 실패: ${e.message}`),
  })
  const rejectMut = useMutation({
    mutationFn: ({ id, reason }) => rejectVerification({ id, reason, reviewerId }),
    onSuccess: () => { invalidate(); setRejectOpen(false) },
    onError: (e) => alert(`거절 실패: ${e.message}`),
  })
  const busy = approveMut.isPending || rejectMut.isPending

  if (!isOpen) return null
  return (
    <>
    <div className="fixed inset-0 z-[75] bg-black/40 flex items-center justify-center p-5" onClick={onClose}>
      <div className="w-full max-w-md max-h-[88vh] flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 — 남은 건수 */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
          <ClipboardCheck className="w-5 h-5 text-emerald-500" />
          <h2 className="text-[16px] font-bold text-gray-800">인증 심사</h2>
          {reviews.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold">{reviews.length}</span>
          )}
          <button type="button" onClick={onClose} className="ml-auto p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        {current ? (
          <>
            <div className="flex-1 overflow-y-auto p-5" style={{ touchAction: 'pan-y' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[11px] font-bold flex-shrink-0 max-w-[150px] truncate">{current.m_title}</span>
                <UserAvatar avatarPath={current.u_avatar_path} nickname={current.u_nickname} size="sm" />
                <span className="text-[13px] font-semibold text-gray-700 truncate">{current.u_nickname || '익명'}</span>
                <span className="text-[11px] text-gray-400 ml-auto flex-shrink-0">{formatRelativeKstDay(current.v_submitted_at)}</span>
              </div>
              {current.v_image_path && (
                imageUrl
                  ? <img src={imageUrl} alt="" className="w-full max-h-[46vh] object-contain rounded-lg bg-gray-50" />
                  : <div className="h-40 rounded-lg bg-gray-100 animate-pulse" />
              )}
              {current.v_numeric_value != null && (
                <p className="mt-3 text-sm text-gray-700 flex items-center gap-1.5"><Flag className="w-4 h-4 text-emerald-500" /> 기록 {current.v_numeric_value}</p>
              )}
              {current.v_note && <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">{current.v_note}</p>}
              {!current.v_image_path && !current.v_note && current.v_numeric_value == null && (
                <p className="text-sm text-gray-400 py-6 text-center">제출 내용이 없어요</p>
              )}
            </div>

            <div className="flex items-center gap-2.5 p-4 border-t border-gray-100 flex-shrink-0">
              <button type="button" onClick={() => setRejectOpen(true)} disabled={busy}
                className="px-5 h-12 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:bg-gray-50 transition disabled:opacity-50">거절</button>
              <button type="button" onClick={() => approveMut.mutate(current.v_id)} disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition disabled:opacity-50">
                <Check className="w-4 h-4" strokeWidth={3} /> {busy ? '처리 중...' : '승인'}
              </button>
            </div>
          </>
        ) : (
          <div className="py-16 px-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <Check className="w-7 h-7 text-emerald-500" strokeWidth={2.5} />
            </div>
            <p className="text-[15px] font-bold text-gray-800">심사를 모두 마쳤어요!</p>
            <p className="text-[13px] text-gray-500 mt-1">대기 중인 인증이 없어요.</p>
            <button type="button" onClick={onClose} className="mt-5 px-6 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition">닫기</button>
          </div>
        )}
      </div>
    </div>

    <RejectReasonModal
      isOpen={rejectOpen && !!current}
      onClose={() => setRejectOpen(false)}
      onSubmit={(reason) => current && rejectMut.mutate({ id: current.v_id, reason })}
      busy={rejectMut.isPending}
      title="이 인증을 거절할까요?"
      description="거절하면 점수에서 제외되고 제출자에게 사유가 전달돼요. (기록·사진은 보존)"
      placeholder="예: 미션과 무관한 사진이에요."
    />
    </>
  )
}

export default VerificationReviewModal
