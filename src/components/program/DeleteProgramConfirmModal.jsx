import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { AlertTriangle } from 'lucide-react'

// PUBLISHED 프로그램 삭제 — 이중 확인 (멘트 + 이름 재입력)
// CASCADE 로 missions / verifications / score_ledgers / participants / post_likes / post_comments 모두 사라짐
// onConfirm: () => Promise<void>
function DeleteProgramConfirmModal({ program, isOpen, onClose, onConfirm }) {
  const [nameInput, setNameInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) {
      setNameInput('')
      setIsDeleting(false)
      setError(null)
    }
  }, [isOpen])

  const canDelete = nameInput.trim() === program?.name?.trim()

  const handleDelete = async () => {
    if (!canDelete) return
    setIsDeleting(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      console.error('프로그램 삭제 실패:', err)
      setError(err.message || '삭제에 실패했습니다')
      setIsDeleting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {program && (
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-800 pr-8">
                프로그램을 정말 삭제할까요?
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                "{program.name}"
              </p>
            </div>
          </div>

          {/* 경고 */}
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4 text-sm text-red-700">
            <p className="font-medium mb-1">⚠️ 되돌릴 수 없는 작업이에요</p>
            <ul className="text-xs space-y-0.5 ml-4 list-disc">
              <li>모든 미션, 인증 기록, 부여된 점수 삭제</li>
              <li>참여자 목록 + 좋아요·댓글 모두 삭제</li>
              <li>참여자에게 알림 없이 즉시 사라짐</li>
            </ul>
          </div>

          {/* 이름 재입력 */}
          <label className="block text-sm font-medium text-gray-700 mb-1">
            확인을 위해 프로그램 이름을 그대로 입력해주세요
          </label>
          <p className="text-xs text-gray-500 mb-2">
            예상 입력: <span className="font-mono font-medium text-gray-800">{program.name}</span>
          </p>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder={program.name}
            disabled={isDeleting}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-red-500 disabled:bg-gray-50"
          />

          {error && (
            <p className="mt-3 p-2 bg-red-100 text-red-700 rounded text-sm text-center">
              {error}
            </p>
          )}

          {/* 버튼 */}
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete || isDeleting}
              className="flex-[2] px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-md transition disabled:bg-gray-300"
            >
              {isDeleting ? '삭제 중...' : '영구 삭제'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default DeleteProgramConfirmModal
