import { X } from 'lucide-react'
import { useEffect } from 'react'

function Modal({ isOpen, onClose, children }) {
  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
    }
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])
  
  if (!isOpen) return null
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      {/* 배경 흐림 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* 모달 내용 */}
      <div 
        className="
          relative bg-white shadow-xl overflow-y-auto
          w-full max-h-[90vh] rounded-t-2xl
          sm:max-w-md sm:max-h-[85vh] sm:rounded-lg
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모바일 손잡이 (바텀시트 표시) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition z-10"
        >
          <X className="w-5 h-5" />
        </button>
        
        {children}
      </div>
    </div>
  )
}

export default Modal