import { useState, useRef } from 'react'
import Modal from '../common/Modal'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { Upload, X } from 'lucide-react'

// 인증 제출 모달
// 미션의 requires_image / requires_numeric 메타에 따라 입력 영역을 동적으로 구성:
//   requires_image  → 사진 선택 + Storage 업로드 → image_path
//   requires_numeric → 숫자 입력 → numeric_value
//   둘 다 true (통합 미션) → 두 영역 모두 표시 + 둘 다 필수
// 공통 흐름:
//   verifications INSERT → 018 트리거가 status 자동 결정 → 020 트리거가 점수 부여
function VerificationSubmitModal({ mission, isOpen, onClose, onSuccess }) {
  const { session } = useAuth()
  const fileInputRef = useRef(null)

  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [numericValue, setNumericValue] = useState('')
  const [noteText, setNoteText] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // 미션 메타 — 입력 영역 분기 신호
  const needsImage = !!mission?.requires_image
  const needsNumeric = !!mission?.requires_numeric
  const needsNote = !!mission?.requires_note
  // 다중 인증 (둘 이상 요구) — 라벨 표시 강조용
  const requireCount = [needsImage, needsNumeric, needsNote].filter(Boolean).length
  const isMulti = requireCount >= 2

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
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setSelectedFile(null)
    setPreviewUrl(null)
    setNumericValue('')
    setNoteText('')
    setError(null)
    setIsSubmitting(false)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const handleSubmit = async () => {
    if (!session || !mission) return

    // 입력 검증 — 미션이 요구하는 것만
    if (needsImage && !selectedFile) {
      setError('사진을 선택해주세요')
      return
    }
    if (needsNumeric) {
      const num = parseFloat(numericValue)
      if (!numericValue || isNaN(num) || num <= 0) {
        setError('0보다 큰 숫자를 입력해주세요')
        return
      }
    }
    if (needsNote && !noteText.trim()) {
      setError('소감을 입력해주세요')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const insertData = {
        mission_id: mission.id,
        user_id: session.user.id,
      }
      let imagePath = null

      // 사진 업로드 (필요 시)
      if (needsImage && selectedFile) {
        // SHA-256 해시 계산 — 본인의 같은 사진 중복 인증 차단 (029 마이그레이션)
        const buffer = await selectedFile.arrayBuffer()
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const imageHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
        insertData.image_hash = imageHash

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
        insertData.image_path = path
      }

      // 숫자 입력 (필요 시)
      if (needsNumeric) {
        insertData.numeric_value = parseFloat(numericValue)
      }

      // 소감 입력 (필요 시)
      if (needsNote) {
        insertData.note = noteText.trim()
      }

      const { error: insertError } = await supabase
        .from('verifications')
        .insert(insertData)

      if (insertError) {
        if (imagePath) {
          await supabase.storage.from('verification-images').remove([imagePath])
        }
        // UNIQUE 위반 (같은 사진 중복) — 친화 메시지
        if (insertError.code === '23505') {
          throw new Error('이미 인증에 사용한 사진이에요. 다른 사진을 올려주세요.')
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

  // 제출 버튼 활성화 조건 — 미션이 요구하는 입력이 다 채워졌을 때
  const canSubmit = (() => {
    if (isSubmitting) return false
    if (needsImage && !selectedFile) return false
    if (needsNumeric && !numericValue) return false
    if (needsNote && !noteText.trim()) return false
    if (requireCount === 0) return false  // 인증 UI 없는 feature
    return true
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
            {isMulti && <span className="ml-1 text-emerald-600">· {requireCount}가지 인증</span>}
          </p>

          {/* 안내 설명 (운영자가 미션 만들 때 입력) */}
          {mission.instruction && (
            <p className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              {mission.instruction}
            </p>
          )}

          {/* 사진 영역 */}
          {needsImage && (
            <div className="mb-4">
              {isMulti && (
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📷 인증 사진
                </label>
              )}
              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="미리보기"
                    className="w-full max-h-80 object-contain rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (previewUrl) URL.revokeObjectURL(previewUrl)
                      setSelectedFile(null)
                      setPreviewUrl(null)
                    }}
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
                  className="w-full p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 transition flex flex-col items-center gap-2 text-gray-500 hover:text-green-600 disabled:opacity-50"
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
            </div>
          )}

          {/* 숫자 영역 */}
          {needsNumeric && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isMulti ? '📊 기록 값' : '기록 값'}
              </label>
              <input
                type="number"
                value={numericValue}
                onChange={(e) => setNumericValue(e.target.value)}
                placeholder="예: 8000 (걸음) 또는 5.2 (km)"
                step="0.01"
                min="0"
                disabled={isSubmitting}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                숫자로 본인의 활동 결과를 입력해요
              </p>
            </div>
          )}

          {/* 소감 영역 */}
          {needsNote && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isMulti ? '💬 한 줄 소감' : '소감'}
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="오늘 활동 어땠나요? 한 줄로 남겨주세요"
                rows={3}
                maxLength={300}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 disabled:bg-gray-50 resize-none"
              />
              <p className="text-xs text-gray-500 mt-1 text-right">
                {noteText.length}/300
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
