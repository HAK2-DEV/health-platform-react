import { useRef, useState, useEffect } from 'react'
import { Camera, X, Crop } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { compressThumbnail } from '../../lib/imageCompression'
import { thumbPathOf } from '../../lib/signedUrls'
import ProgramCover from './ProgramCover'
import ImageCropModal from './ImageCropModal'
import ConfirmModal from './ConfirmModal'

// 프로그램 표지 사진 업로더 — 마법사 Step 1 + ProgramEditModal 재사용
// props:
//   ownerId:    auth.uid() (storage path 첫 segment)
//   imagePath:  현재 cover_image_path (NULL 가능)
//   onChange:   (newPath | null) => void
//                  업로드 성공 시 path 문자열, 삭제 시 null. 부모는 받아서 폼 state 갱신.
//   categories: fallback 미리보기용 카테고리 키 배열
//   name:       fallback alt 텍스트
//   disabled:   상위 폼이 저장 중일 때 비활성화
//
// 동작:
//   - 파일 선택 → 검증(10MB) → 크롭 모달(16:9) → 1200x675 Blob → 기존 삭제 후 업로드 → onChange(newPath)
//   - 삭제 버튼 → storage 삭제 + onChange(null)
//   - 업로드 중 로딩 표시 (덮개 + 스피너)

const MAX_SIZE_BYTES = 10 * 1024 * 1024  // 10MB (crop 후 축소되므로 원본은 넉넉히)

function CoverImageUploader({ ownerId, imagePath, onChange, categories, name, disabled }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  // 크롭 모달 — 파일 선택 시 바로 업로드하지 않고 크롭 먼저
  const [cropSrc, setCropSrc] = useState(null)        // 크롭 모달의 현재 소스
  const [originalSrc, setOriginalSrc] = useState(null) // 마지막 선택 원본(재조정용·세션 유지)
  const [isCropOpen, setIsCropOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)  // 표지 삭제 확인 모달

  // 원본 objectURL 메모리 정리 (값 변경/언마운트 시)
  useEffect(() => () => { if (originalSrc) URL.revokeObjectURL(originalSrc) }, [originalSrc])

  const triggerPick = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  // 파일 선택 → 크롭 모달 열기 (업로드는 크롭 후)
  const handleFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일 다시 선택 가능하게
    if (!file || !ownerId) return

    if (file.size > MAX_SIZE_BYTES) {
      setError('이미지가 너무 커요 (최대 10MB)')
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능해요')
      return
    }
    setError(null)
    const url = URL.createObjectURL(file)
    setOriginalSrc(url)   // 원본 보관 → 이후 '비율 조정' 시 재사용
    setCropSrc(url)
    setIsCropOpen(true)
  }

  // 다시 업로드 없이 크롭만 재조정 — 원본이 있으면 원본, 없으면 저장된 표지로
  const reAdjust = () => {
    if (disabled || uploading) return
    const src = originalSrc || (imagePath
      ? supabase.storage.from('program-covers').getPublicUrl(imagePath).data?.publicUrl
      : null)
    if (!src) { setError('조정할 이미지가 없어요'); return }
    setError(null)
    setCropSrc(src)
    setIsCropOpen(true)
  }

  const closeCropModal = () => {
    setIsCropOpen(false)
    setCropSrc(null)  // 원본(originalSrc)은 재조정 위해 유지 — 여기선 revoke 안 함
  }

  // 크롭 완료 → 1200x675 JPEG Blob 업로드
  const handleCropComplete = async (blob) => {
    setUploading(true)
    setError(null)
    try {
      // 1) 기존 이미지(+썸네일) 가 있으면 먼저 storage 에서 삭제 (orphan 방지)
      if (imagePath) {
        await supabase.storage.from('program-covers').remove([imagePath, thumbPathOf(imagePath)])
      }

      // 2) 원본(1200x675) 업로드 — crop 결과는 항상 jpeg
      const newPath = `${ownerId}/${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('program-covers')
        .upload(newPath, blob, { upsert: false, contentType: 'image/jpeg' })

      if (upErr) throw upErr

      // 3) 카드/목록용 400px 썸네일도 함께 업로드 — 대시보드 캐러셀 등에서 가벼운 버전 사용(로딩 stall 방지).
      //    실패해도 치명적 아님 — ProgramCover 가 원본으로 폴백.
      try {
        const thumbBlob = await compressThumbnail(blob)
        if (thumbBlob) {
          await supabase.storage.from('program-covers')
            .upload(thumbPathOf(newPath), thumbBlob, { upsert: true, contentType: 'image/jpeg' })
        }
      } catch { /* 썸네일 생략 */ }

      // 4) 부모에 새 path 알림 + 모달 닫기
      onChange(newPath)
      closeCropModal()
    } catch (err) {
      console.error('표지 업로드 실패:', err)
      setError(err.message || '업로드에 실패했습니다')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    if (disabled || uploading) return
    setConfirmRemove(true)
  }
  const doRemove = async () => {
    setUploading(true)
    setError(null)
    try {
      if (imagePath) {
        await supabase.storage.from('program-covers').remove([imagePath, thumbPathOf(imagePath)])
      }
      onChange(null)
    } catch (err) {
      console.error('표지 삭제 실패:', err)
      setError(err.message || '삭제에 실패했습니다')
    } finally {
      setUploading(false)
      setConfirmRemove(false)
    }
  }

  return (
    <div>
      {/* 미리보기 + 클릭 영역 */}
      <button
        type="button"
        onClick={triggerPick}
        disabled={disabled || uploading}
        className="relative w-full block group disabled:opacity-50"
      >
        <ProgramCover
          imagePath={imagePath}
          categories={categories}
          name={name}
          variant="hero"
        />

        {/* 오버레이 — hover 시 또는 이미지 없을 때 안내 */}
        <div className={`
          absolute inset-0 flex items-center justify-center
          bg-black/30 text-white text-sm font-medium gap-1.5
          rounded-2xl transition
          ${imagePath ? 'opacity-0 group-hover:opacity-100' : 'opacity-100 bg-black/10'}
        `}>
          <Camera className="w-4 h-4" />
          <span>{imagePath ? '사진 변경' : '사진 추가 (선택)'}</span>
        </div>

        {/* 업로드 중 — 전체 덮개 */}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
      </button>

      {/* 삭제 버튼 + 안내 */}
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-gray-500">
          가로형(16:9) 권장 · 최대 10MB
        </p>
        {imagePath && !uploading && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={reAdjust}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600 transition disabled:opacity-50"
            >
              <Crop className="w-3 h-3" />
              비율 조정
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition disabled:opacity-50"
            >
              <X className="w-3 h-3" />
              표지 삭제
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 p-2 bg-red-100 text-red-700 rounded text-xs text-center">
          {error}
        </p>
      )}

      {/* 표지 크롭 모달 — 16:9 사각형, 1200x675 */}
      <ImageCropModal
        isOpen={isCropOpen}
        imageSrc={cropSrc}
        onClose={closeCropModal}
        onComplete={handleCropComplete}
        isUploading={uploading}
        aspect={16 / 9}
        cropShape="rect"
        outputWidth={1200}
        outputHeight={675}
        title="대표 사진 편집"
        description="드래그하고 확대·축소해 표지 영역을 맞춰주세요"
      />

      {/* 표지 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={doRemove}
        title="표지 사진을 삭제할까요?"
        message="삭제하면 카테고리 이모지로 대체돼요."
        confirmLabel="삭제"
        danger
        busy={uploading}
      />
    </div>
  )
}

export default CoverImageUploader
