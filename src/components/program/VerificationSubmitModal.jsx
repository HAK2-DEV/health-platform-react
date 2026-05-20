import { useState, useRef } from 'react'
import Modal from '../common/Modal'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { Upload, X } from 'lucide-react'

// 인증 제출 모달
// feature 별 분기:
//   image_upload   → 사진 선택 + Storage 업로드 + image_path 저장
//   numeric_record → 숫자 입력 + numeric_value 저장
// 공통 흐름:
//   verifications INSERT → 018 BEFORE 트리거가 status 자동 결정
//                       → 020 AFTER 트리거가 점수 부여 가드 검사
function VerificationSubmitModal({ mission, isOpen, onClose, onSuccess }) {
  const { session } = useAuth()
  const fileInputRef = useRef(null)

  // image_upload 상태
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  // numeric_record 상태
  const [numericValue, setNumericValue] = useState('')

  // 공통
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('파일 크기는 5MB 이하여야 합니다')
      return
    }

    setError(null)
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const resetState = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(null)
    setNumericValue('')
    setError(null)
    setIsSubmitting(false)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const handleSubmit = async () => {
    if (!session || !mission) return

    // feature 별 클라이언트 검증
    if (mission.feature === 'image_upload') {
      if (!selectedFile) {
        setError('사진을 선택해주세요')
        return
      }
    } else if (mission.feature === 'numeric_record') {
      const num = parseFloat(numericValue)
      if (!numericValue || isNaN(num) || num <= 0) {
        setError('0보다 큰 숫자를 입력해주세요')
        return
      }
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let imagePath = null

      // image_upload 만 Storage 업로드 단계 필요
      if (mission.feature === 'image_upload' && selectedFile) {
        const ext = selectedFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const fileName = `${Date.now()}.${ext}`
        const path = `${session.user.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('verification-images')
          .upload(path, selectedFile)

        if (uploadError) {
          throw new Error(`업로드 실패: ${uploadError.message}`)
        }
        imagePath = path
      }

      // verifications INSERT (feature 별 컬럼 분기)
      const insertData = {
        mission_id: mission.id,
        user_id: session.user.id,
      }

      if (mission.feature === 'image_upload') {
        insertData.image_path = imagePath
      } else if (mission.feature === 'numeric_record') {
        insertData.numeric_value = parseFloat(numericValue)
      }

      const { error: insertError } = await supabase
        .from('verifications')
        .insert(insertData)

      if (insertError) {
        // INSERT 실패 시 업로드된 사진 정리 (고아 파일 방지)
        if (imagePath) {
          await supabase.storage
            .from('verification-images')
            .remove([imagePath])
        }
        throw new Error(`인증 제출 실패: ${insertError.message}`)
      }

      onSuccess?.()
      handleClose()
    } catch (err) {
      console.error('인증 제출 오류:', err)
      setError(err.message)
      setIsSubmitting(false)
    }
  }

  // 제출 버튼 활성화 조건
  const canSubmit = (() => {
    if (isSubmitting) return false
    if (mission?.feature === 'image_upload') return !!selectedFile
    if (mission?.feature === 'numeric_record') return !!numericValue
    return false
  })()

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      {mission && (
        <div className="p-6">
          <h2 className="text-xl font-medium text-gray-800 mb-1 pr-8">
            {mission.title}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {mission.point}P · {mission.verification_type === 'AUTO' ? '자동 승인' : '운영자 심사'}
          </p>

          {/* === feature 별 입력 영역 === */}

          {/* image_upload */}
          {mission.feature === 'image_upload' && (
            <>
              {previewUrl ? (
                <div className="relative mb-4">
                  <img
                    src={previewUrl}
                    alt="미리보기"
                    className="w-full max-h-96 object-contain rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={resetState}
                    disabled={isSubmitting}
                    className="absolute top-2 right-2 p-1 bg-white/90 hover:bg-white rounded-full text-gray-700 shadow disabled:opacity-50"
                    title="다시 선택"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="w-full mb-4 p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 transition flex flex-col items-center gap-2 text-gray-500 hover:text-green-600 disabled:opacity-50"
                >
                  <Upload className="w-8 h-8" />
                  <span className="text-sm">사진 선택하기</span>
                  <span className="text-xs text-gray-400">JPG / PNG / 최대 5MB</span>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={isSubmitting}
                className="hidden"
              />
            </>
          )}

          {/* numeric_record */}
          {mission.feature === 'numeric_record' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                기록 값
              </label>
              <input
                type="number"
                value={numericValue}
                onChange={(e) => setNumericValue(e.target.value)}
                placeholder="예: 8000 (걸음) 또는 5.2 (km)"
                step="0.01"
                min="0"
                disabled={isSubmitting}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-green-500 disabled:bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                숫자로 본인의 활동 결과를 입력해요
              </p>
            </div>
          )}

          {/* 에러 */}
          {error && (
            <p className="mb-3 p-2 bg-red-100 text-red-700 rounded text-sm text-center">
              {error}
            </p>
          )}

          {/* 버튼 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-[2] px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-md transition disabled:bg-gray-400"
            >
              {isSubmitting ? '제출 중...' : '인증 제출'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default VerificationSubmitModal
