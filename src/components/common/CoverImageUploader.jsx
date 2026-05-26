import { useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import ProgramCover from './ProgramCover'

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
//   - 파일 선택 → 검증(5MB) → 기존 이미지 있으면 storage 에서 삭제 → 새 파일 업로드 → onChange(newPath)
//   - 삭제 버튼 → storage 삭제 + onChange(null)
//   - 업로드 중 로딩 표시 (덮개 + 스피너)

const MAX_SIZE_BYTES = 5 * 1024 * 1024  // 5MB

function CoverImageUploader({ ownerId, imagePath, onChange, categories, name, disabled }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const triggerPick = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    // input 값 리셋 — 같은 파일 다시 선택 가능하게
    e.target.value = ''
    if (!file || !ownerId) return

    if (file.size > MAX_SIZE_BYTES) {
      setError('이미지가 너무 커요 (최대 5MB)')
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능해요')
      return
    }

    setUploading(true)
    setError(null)

    try {
      // 1) 기존 이미지가 있으면 먼저 storage 에서 삭제 (orphan 방지)
      if (imagePath) {
        await supabase.storage.from('program-covers').remove([imagePath])
      }

      // 2) 새 파일 업로드 — path: {ownerId}/{timestamp}.{ext}
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const newPath = `${ownerId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('program-covers')
        .upload(newPath, file, { upsert: false, contentType: file.type })

      if (upErr) throw upErr

      // 3) 부모에 새 path 알림
      onChange(newPath)
    } catch (err) {
      console.error('표지 업로드 실패:', err)
      setError(err.message || '업로드에 실패했습니다')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    if (disabled || uploading) return
    if (!window.confirm('표지 사진을 삭제할까요? (카테고리 이모지로 대체돼요)')) return

    setUploading(true)
    setError(null)
    try {
      if (imagePath) {
        await supabase.storage.from('program-covers').remove([imagePath])
      }
      onChange(null)
    } catch (err) {
      console.error('표지 삭제 실패:', err)
      setError(err.message || '삭제에 실패했습니다')
    } finally {
      setUploading(false)
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
          가로형 사진 권장 · 최대 5MB
        </p>
        {imagePath && !uploading && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition disabled:opacity-50"
          >
            <X className="w-3 h-3" />
            표지 삭제
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 p-2 bg-red-100 text-red-700 rounded text-xs text-center">
          {error}
        </p>
      )}
    </div>
  )
}

export default CoverImageUploader
