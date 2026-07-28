import { useState, useEffect } from 'react'
import { Ban } from 'lucide-react'

// 거절 사유 입력 — 중앙 카드. onSubmit(reason) → 호출측이 처리. 사유는 작성자에게 알림으로 전달.
//   게시글/인증 공용 — title·description·placeholder 로 문구 교체. (기본값=게시글)
function RejectReasonModal({
  isOpen, onClose, onSubmit, busy = false, postLabel,
  title = '게시글을 거절할까요?',
  description,
  placeholder = '예: 게시판 주제와 맞지 않아요.',
  presets = [],
}) {
  const [reason, setReason] = useState('')
  useEffect(() => { if (isOpen) setReason('') }, [isOpen])
  if (!isOpen) return null
  const defaultDesc = (postLabel ? '“' + postLabel + '” 글을 거절해요. ' : '이 글을 거절해요. ')
    + '거절하면 글이 삭제되고 작성자에게 사유가 전달돼요.'
  return (
    <div className="fixed inset-0 z-[85] bg-black/40 flex items-center justify-center p-5" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0"><Ban className="w-4 h-4" /></span>
          <h4 className="text-[15px] font-bold text-gray-800">{title}</h4>
        </div>
        <p className="text-[13px] text-gray-600 leading-relaxed break-keep" style={{ marginBottom: '12px' }}>
          {description || defaultDesc}
        </p>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[12px] font-semibold text-gray-500">거절 사유 <span className="text-gray-400 font-normal">(작성자에게 전달)</span></label>
          <span className="text-[11px] text-gray-400">{reason.length}/100</span>
        </div>
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {presets.map(p => (
              <button key={p} type="button" onClick={() => setReason(r => (r === p ? '' : p))}
                className={`px-2.5 py-1 rounded-full text-[12px] font-semibold border transition ${reason === p ? 'bg-red-500 border-red-500 text-white' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          autoFocus
          maxLength={100}
          placeholder={placeholder}
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
