import { useState, useEffect } from 'react'
import { Ban } from 'lucide-react'

// 게시글 거절 사유 입력 — 중앙 카드. onSubmit(reason) → 호출측이 RPC 실행.
//   사유는 작성자에게 알림으로 전달됨. 빈 사유도 허용(권장은 아님).
function RejectReasonModal({ isOpen, onClose, onSubmit, busy = false, postLabel }) {
  const [reason, setReason] = useState('')
  useEffect(() => { if (isOpen) setReason('') }, [isOpen])
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[85] bg-black/40 flex items-center justify-center p-5" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0"><Ban className="w-4 h-4" /></span>
          <h4 className="text-[15px] font-bold text-gray-800">게시글을 거절할까요?</h4>
        </div>
        <p className="text-[13px] text-gray-600 leading-relaxed break-keep" style={{ marginBottom: '12px' }}>
          {postLabel ? <><b className="text-gray-800">“{postLabel}”</b> 글을 거절해요. </> : '이 글을 거절해요. '}
          거절하면 글이 삭제되고 작성자에게 사유가 전달돼요.
        </p>
        <label className="block text-[12px] font-semibold text-gray-500 mb-1">거절 사유 <span className="text-gray-400 font-normal">(작성자에게 전달)</span></label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          autoFocus
          maxLength={300}
          placeholder="예: 게시판 주제와 맞지 않아요."
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-[10px] focus:outline-none focus:border-red-400 resize-none text-sm break-words"
          style={{ marginBottom: '14px' }}
        />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={busy}
            className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition disabled:opacity-50">취소</button>
          <button type="button" onClick={() => onSubmit(reason.trim())} disabled={busy}
            className="flex-[1.4] h-11 rounded-xl text-white text-sm font-bold bg-red-500 hover:bg-red-600 transition disabled:opacity-50">
            {busy ? '처리 중...' : '거절하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default RejectReasonModal
