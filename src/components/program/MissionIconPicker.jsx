import { useRef, useState } from 'react'
import { Upload, X, Check } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import ImageCropModal from '../common/ImageCropModal'
import { MISSION_ICONS, resolveMissionIcon, normalizeMissionIcon } from '../../lib/missionIcons'

// 미션 아이콘 선택기 — 기본 아이콘 갤러리 + 직접 업로드 + 없음.
// props:
//   ownerId:  storage path 첫 segment (auth.uid() == 프로그램 owner)
//   value:    현재 icon_path (프리셋 상대경로 | 커스텀 full URL | null)
//   onChange: (icon_path | null) => void
//   disabled: 상위 폼 저장 중
//
// 커스텀 업로드는 별도 버킷 없이 공개 버킷 program-covers 재사용 → getPublicUrl 전체 URL 저장.
const MAX_SIZE_BYTES = 10 * 1024 * 1024

function MissionIconPicker({ ownerId, value, onChange, disabled }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [cropSrc, setCropSrc] = useState(null)
  const [isCropOpen, setIsCropOpen] = useState(false)

  const isCustom = !!value && /^https?:\/\//.test(value)
  // 옛 경로를 가진 기존 미션도 새 아이콘이 선택 상태로 보이도록 정규화 비교
  const normValue = isCustom ? value : normalizeMissionIcon(value)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !ownerId) return
    if (file.size > MAX_SIZE_BYTES) { setError('이미지가 너무 커요 (최대 10MB)'); return }
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 업로드 가능해요'); return }
    setError(null)
    setCropSrc(URL.createObjectURL(file))
    setIsCropOpen(true)
  }

  const closeCrop = () => {
    setIsCropOpen(false)
    setCropSrc(prev => { if (prev) URL.revokeObjectURL(prev); return null })
  }

  const handleCropComplete = async (blob) => {
    setUploading(true)
    setError(null)
    try {
      const path = `${ownerId}/mission-icon-${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('program-covers')
        .upload(path, blob, { upsert: false, contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('program-covers').getPublicUrl(path)
      onChange(data.publicUrl)
      closeCrop()
    } catch (err) {
      console.error('미션 아이콘 업로드 실패:', err)
      setError(err.message || '업로드에 실패했어요')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => { if (!disabled && !uploading) inputRef.current?.click() }}
          disabled={disabled || uploading}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:border-emerald-400 hover:text-emerald-600 transition disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" /> 직접 업로드
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled || uploading}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 transition disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" /> 아이콘 없음
          </button>
        )}
        {uploading && <span className="text-xs text-gray-400">업로드 중...</span>}
      </div>

      <div className="grid grid-cols-6 gap-2 max-h-44 overflow-y-auto p-2 border border-gray-100 rounded-lg bg-gray-50/50">
        {/* 업로드된 커스텀 아이콘 — 갤러리 맨 앞에 선택 상태로 */}
        {isCustom && (
          <div className="relative aspect-square rounded-lg border-2 border-emerald-500 overflow-hidden">
            <img src={resolveMissionIcon(value)} alt="커스텀 아이콘" className="w-full h-full object-cover" />
            <Check className="absolute top-0.5 right-0.5 w-4 h-4 text-emerald-600 bg-white rounded-full p-0.5" />
          </div>
        )}
        {MISSION_ICONS.map(ic => {
          const selected = normValue === ic
          return (
            <button
              key={ic}
              type="button"
              onClick={() => onChange(ic)}
              disabled={disabled || uploading}
              className={`relative aspect-square rounded-lg border-2 overflow-hidden transition disabled:opacity-50
                ${selected ? 'border-emerald-500' : 'border-transparent hover:border-gray-300 bg-white'}`}
            >
              <img src={`/mission-icons/${ic}`} alt="" loading="lazy" className="w-full h-full object-contain bg-white" />
              {selected && <Check className="absolute top-0.5 right-0.5 w-4 h-4 text-emerald-600 bg-white rounded-full p-0.5" />}
            </button>
          )
        })}
      </div>

      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

      <ImageCropModal
        isOpen={isCropOpen}
        imageSrc={cropSrc}
        onClose={closeCrop}
        onComplete={handleCropComplete}
        isUploading={uploading}
        aspect={1}
        cropShape="rect"
        outputWidth={256}
        outputHeight={256}
        title="아이콘 편집"
        description="아이콘 영역을 정사각형으로 맞춰주세요"
      />
    </div>
  )
}

export default MissionIconPicker
