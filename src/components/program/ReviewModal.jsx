import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { Check, X } from 'lucide-react'

// 운영자 심사 모달
// 본인의 (가) 진화 후 MANUAL 미션 부활 — 본인이 운영자 미션 직접 추가 시 MANUAL 선택 가능
// 030 get_pending_reviews RPC + verifications UPDATE 패턴
// 015 RLS UPDATE 정책 (owners can update) + 020 트리거 (status→APPROVED 시 자동 점수)
function ReviewModal({ program, isOpen, onClose, onSuccess }) {
  const { session } = useAuth()
  const [reviews, setReviews] = useState([])
  const [imageUrls, setImageUrls] = useState({}) // v_id → signed url
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // PENDING_REVIEW 목록 fetch (RPC)
  const fetchPending = async () => {
    if (!program) return
    setIsLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase
      .rpc('get_pending_reviews', { p_program_id: program.id })

    if (rpcError) {
      console.error('심사 목록 조회 실패:', rpcError)
      setError(rpcError.message)
      setIsLoading(false)
      return
    }

    setReviews(data || [])

    // 각 사진 signed URL 병렬 fetch (1시간 유효)
    const urls = {}
    await Promise.all(
      (data || [])
        .filter(r => r.v_image_path)
        .map(async (r) => {
          const { data: urlData } = await supabase.storage
            .from('verification-images')
            .createSignedUrl(r.v_image_path, 3600)
          if (urlData) urls[r.v_id] = urlData.signedUrl
        })
    )
    setImageUrls(urls)
    setIsLoading(false)
  }

  useEffect(() => {
    if (isOpen) fetchPending()
    else {
      setRejectingId(null)
      setRejectReason('')
      setError(null)
    }
  }, [isOpen, program])

  const handleApprove = async (verificationId) => {
    setIsProcessing(true)
    const { error: updateError } = await supabase
      .from('verifications')
      .update({
        status: 'APPROVED',
        reviewed_at: new Date().toISOString(),
        reviewer_id: session.user.id,
      })
      .eq('id', verificationId)

    if (updateError) {
      console.error('승인 실패:', updateError)
      setError(updateError.message)
      setIsProcessing(false)
      return
    }

    // 목록에서 제거 (낙관적 UI)
    setReviews(reviews.filter(r => r.v_id !== verificationId))
    setIsProcessing(false)
    onSuccess?.()
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError('반려 사유를 입력해주세요')
      return
    }
    setIsProcessing(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('verifications')
      .update({
        status: 'REJECTED',
        reviewed_at: new Date().toISOString(),
        reviewer_id: session.user.id,
        rejection_reason: rejectReason.trim(),
      })
      .eq('id', rejectingId)

    if (updateError) {
      console.error('반려 실패:', updateError)
      setError(updateError.message)
      setIsProcessing(false)
      return
    }

    setReviews(reviews.filter(r => r.v_id !== rejectingId))
    setRejectingId(null)
    setRejectReason('')
    setIsProcessing(false)
    onSuccess?.()
  }

  // 제출 시각 포맷
  const formatTime = (ts) => {
    if (!ts) return ''
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-xl font-medium text-gray-800 mb-1 pr-8">
          ✅ 인증 심사
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          {program?.name} · 대기 {reviews.length}건
        </p>

        {error && (
          <p className="mb-3 p-2 bg-red-100 text-red-700 rounded text-sm text-center">
            {error}
          </p>
        )}

        {isLoading ? (
          <div className="p-6 text-center text-gray-500 text-sm">불러오는 중...</div>
        ) : reviews.length === 0 ? (
          <div className="p-8 bg-gray-50 rounded-2xl text-center">
            <div className="text-4xl mb-2 opacity-60">📭</div>
            <p className="text-sm text-gray-500">심사 대기 중인 인증이 없어요</p>
          </div>
        ) : (
          <div className="grid gap-3 max-h-[60vh] overflow-y-auto">
            {reviews.map(r => (
              <div
                key={r.v_id}
                className="border border-gray-200 rounded-2xl p-3"
              >
                {/* 사진 (있으면) */}
                {r.v_image_path && imageUrls[r.v_id] && (
                  <img
                    src={imageUrls[r.v_id]}
                    alt="인증 사진"
                    className="w-full max-h-64 object-contain rounded-lg bg-gray-50 mb-2"
                  />
                )}

                {/* 미션/참여자 정보 */}
                <div className="mb-2">
                  <h3 className="font-medium text-gray-800 text-sm">{r.m_title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {r.u_nickname} · {formatTime(r.v_submitted_at)} · {r.m_point}P
                  </p>
                </div>

                {/* 숫자 인증 */}
                {r.v_numeric_value != null && (
                  <p className="mb-1 text-sm text-gray-700">
                    📊 기록: <span className="font-medium">{r.v_numeric_value}</span>
                  </p>
                )}

                {/* 소감 */}
                {r.v_note && (
                  <p className="mb-2 p-2 bg-gray-50 rounded text-sm text-gray-700 whitespace-pre-wrap">
                    💬 {r.v_note}
                  </p>
                )}

                {/* 승인/반려 버튼 또는 반려 사유 입력 */}
                {rejectingId === r.v_id ? (
                  <div className="mt-2">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="반려 사유를 입력해주세요"
                      rows={2}
                      maxLength={200}
                      disabled={isProcessing}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-red-500 disabled:bg-gray-50 resize-none text-sm"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => { setRejectingId(null); setRejectReason('') }}
                        disabled={isProcessing}
                        className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md transition disabled:opacity-50"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={isProcessing || !rejectReason.trim()}
                        className="flex-[2] px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-md transition disabled:bg-gray-400"
                      >
                        {isProcessing ? '처리 중...' : '반려 확정'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setRejectingId(r.v_id)}
                      disabled={isProcessing}
                      className="flex items-center justify-center gap-1 flex-1 px-3 py-2 bg-white border-2 border-red-200 hover:bg-red-50 text-red-600 text-sm rounded-md transition disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      반려
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(r.v_id)}
                      disabled={isProcessing}
                      className="flex items-center justify-center gap-1 flex-[2] px-3 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm rounded-md transition disabled:bg-gray-400"
                    >
                      <Check className="w-4 h-4" />
                      승인
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 닫기 버튼 */}
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-4 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition"
        >
          닫기
        </button>
      </div>
    </Modal>
  )
}

export default ReviewModal
