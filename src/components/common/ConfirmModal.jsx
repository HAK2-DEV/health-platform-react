import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

// 공용 확인 모달 — window.confirm 대체 (한줄 설명 모달과 동일 오버레이 스타일)
//   props: isOpen, onClose, onConfirm, title, message, confirmLabel, danger, busy
function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmLabel = '확인', danger = false, busy = false }) {
  useBodyScrollLock(isOpen)  // iOS 배경 스크롤 방지
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-5" onClick={onClose}>
      <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-[15px] font-bold text-gray-800 mb-1.5">{title}</h4>
        {message && <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-line break-keep" style={{ marginBottom: '9px' }}>{message}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition">취소</button>
          <button type="button" onClick={onConfirm} disabled={busy}
            className={`flex-[1.4] h-11 rounded-xl text-white text-sm font-bold transition disabled:opacity-50 ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
            {busy ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
