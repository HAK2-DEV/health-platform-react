import { useState, useCallback, useEffect } from 'react'
import Cropper from 'react-easy-crop'
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react'
import Modal from './Modal'
import { getCroppedImg } from '../../lib/cropImage'

// 범용 이미지 크롭 모달 (네이버 밴드 스타일).
//   - 아바타: aspect=1, cropShape="round", 512x512
//   - 표지:   aspect=16/9, cropShape="rect", 1200x675
//   - react-easy-crop: 드래그(위치) + 핀치/슬라이더(확대축소)
//   - cropShape 마스크가 곧 저장 결과 미리보기 (보이는 영역 = 저장될 영역)
//   - 저장 시 outputWidth×outputHeight JPEG Blob 으로 crop → onComplete(blob)
//
// props:
//   isOpen, imageSrc(objectURL), onClose, onComplete(blob), isUploading
//   aspect=1, cropShape='round', outputWidth=512, outputHeight=512
//   title='사진 편집', description
function ImageCropModal({
  isOpen,
  imageSrc,
  onClose,
  onComplete,
  isUploading,
  aspect = 1,
  cropShape = 'round',
  outputWidth = 512,
  outputHeight = 512,
  title = '사진 편집',
  description = '드래그하고 확대·축소해 위치를 맞춰주세요',
  minZoom = 0.3,  // 1 미만 허용 → 작은 이미지도 여백 두고 축소 배치 가능
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)

  // 새 이미지로 모달 열릴 때마다 crop/zoom 초기화
  useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
      setProcessing(false)
      setError(null)
    }
  }, [isOpen, imageSrc])

  const onCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  const busy = processing || isUploading

  const handleSave = async () => {
    if (!croppedAreaPixels || busy) return
    setProcessing(true)
    setError(null)
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, outputWidth, outputHeight)
      onComplete(blob)
    } catch (err) {
      console.error('이미지 crop 실패:', err)
      setError(err.message || '이미지 처리에 실패했어요')
      setProcessing(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={busy ? () => {} : onClose}>
      <div className="p-6">
        <h2 className="text-xl font-medium text-gray-800 mb-1 pr-8">
          {title}
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          {description}
        </p>

        {/* 크롭 영역 — cropShape 마스크가 곧 저장될 미리보기 */}
        <div className="relative w-full aspect-square bg-gray-900 rounded-2xl overflow-hidden mb-4">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={cropShape}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              minZoom={minZoom}
              maxZoom={3}
              restrictPosition={false}
              zoomWithScroll
            />
          )}
        </div>

        {/* 확대/축소 슬라이더 */}
        <div className="flex items-center gap-3 mb-5">
          <ZoomOut className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="range"
            min={minZoom}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={busy}
            className="flex-1 accent-emerald-500 disabled:opacity-50"
          />
          <ZoomIn className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </div>

        {error && (
          <p className="mb-3 text-xs text-red-600 text-center">{error}</p>
        )}

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !croppedAreaPixels}
            className="flex-[2] inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-md transition disabled:bg-gray-400 disabled:from-gray-400 disabled:to-gray-400"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ImageCropModal
