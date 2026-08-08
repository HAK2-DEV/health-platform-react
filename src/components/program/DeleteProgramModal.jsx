import { useState, useEffect } from 'react'
import { useKeyboardInset } from '../../hooks/useKeyboardInset'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { AlertTriangle, ChevronLeft } from 'lucide-react'

// 프로그램 삭제 — 2단계 확인 (운영자 전용, 호출부에서 isOwner 가드).
//   1) 강력 경고 + 프로그램 제목을 정확히 입력해야 다음 진행
//   2) 최종 "정말 삭제할까요?" — 되돌릴 수 없음
// 화면 중앙 카드 오버레이 (ConfirmModal 과 동일 스타일).
// props: isOpen, programTitle, onClose, onConfirm, busy
function DeleteProgramModal({ isOpen, programTitle = '', onClose, onConfirm, busy = false }) {
  useBodyScrollLock(isOpen)  // iOS 배경 스크롤 방지
  const kbInset = useKeyboardInset()   // iOS 키보드 높이 — 제목 확인 입력 시 카드 위로
  const [step, setStep] = useState(1)
  const [typed, setTyped] = useState('')

  // 열 때마다 1단계 + 입력 초기화
  useEffect(() => {
    if (isOpen) { setStep(1); setTyped('') }
  }, [isOpen])

  if (!isOpen) return null

  const titleMatch = typed.trim() === programTitle.trim() && programTitle.trim() !== ''
  const handleClose = () => { if (!busy) onClose() }

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-5" style={{ paddingBottom: kbInset ? kbInset + 20 : undefined, transition: 'padding-bottom .2s ease' }} onClick={handleClose}>
      <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {step === 1 && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-600 flex-shrink-0">
                <AlertTriangle className="w-[18px] h-[18px]" />
              </span>
              <h4 className="text-[15px] font-bold text-gray-900">프로그램 삭제</h4>
            </div>

            <div className="mb-3.5 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-[12px] text-red-700 leading-relaxed break-keep">
                이 작업은 <b>되돌릴 수 없습니다.</b> 프로그램과 함께 모든
                미션·퀴즈·참여자·인증 기록·점수·게시물이 <b>영구 삭제</b>됩니다.
                신중하게 진행해주세요.
              </p>
            </div>

            <label className="block text-[12px] font-medium text-gray-700 mb-1.5 break-keep">
              확인을 위해 제목 <span className="font-bold text-gray-900">“{programTitle}”</span> 을(를) 그대로 입력하세요.
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={programTitle}
              autoFocus
              disabled={busy}
              className="w-full h-10 px-3 mb-4 rounded-xl border border-gray-300 outline-none text-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:opacity-50"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={busy}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!titleMatch || busy}
                className="flex-[1.4] h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-center gap-1 mb-2">
              <button type="button" onClick={() => !busy && setStep(1)} className="p-1 -ml-1 text-gray-500 hover:text-gray-800" aria-label="뒤로">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h4 className="text-[15px] font-bold text-gray-900">정말 삭제할까요?</h4>
            </div>

            <p className="text-[13px] text-gray-600 leading-relaxed break-keep mb-4">
              <b className="text-gray-900">“{programTitle}”</b> 프로그램을 영구 삭제합니다.
              마지막 확인이에요. 이 작업은 <b className="text-red-600">되돌릴 수 없습니다.</b>
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => !busy && setStep(1)}
                disabled={busy}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="flex-[1.4] h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition disabled:opacity-50"
              >
                {busy ? '삭제 중...' : '영구 삭제'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default DeleteProgramModal
