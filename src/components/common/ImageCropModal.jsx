import { useState, useCallback, useEffect } from 'react'
import Cropper from 'react-easy-crop'
import { Loader2, ZoomIn, ZoomOut, Camera, Trash2 } from 'lucide-react'
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
  initialCrop = { x: 0, y: 0 },   // 재진입(위치 조정) 시 이전 위치로 열기
  initialZoom = 1,
  aspectOptions,  // [{label, value}] — 주면 비율 토글 노출 + 출력 크기 자동(최장변 1280)
  cropShape = 'round',
  outputWidth = 512,
  outputHeight = 512,
  title = '사진 편집',
  description = '드래그하고 확대·축소해 위치를 맞춰주세요',
  minZoom = 0.3,  // 1 미만 허용 → 작은 이미지도 여백 두고 축소 배치 가능
  onPickNew,   // 주면 「변경」(다른 사진 선택) 버튼 노출
  onDelete,    // 주면 「삭제」 버튼 노출
  cropOverlay, // 주면 크롭 영역(저장될 사각형)에 정확히 겹쳐 렌더 — 실제 표시 미리보기(페이드 등). pointer-events-none.
}) {
  const [crop, setCrop] = useState(initialCrop)
  const [zoom, setZoom] = useState(initialZoom)
  const [activeAspect, setActiveAspect] = useState(aspect)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)

  // 새 이미지로 모달 열릴 때마다 crop/zoom 초기화(재진입이면 initialCrop/Zoom 으로)
  useEffect(() => {
    if (isOpen) {
      setCrop(initialCrop)
      setZoom(initialZoom)
      setActiveAspect(aspect)
      setCroppedAreaPixels(null)
      setProcessing(false)
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      let outW = outputWidth, outH = outputHeight
      if (aspectOptions) {
        // 비율 토글 모드 — 최장변 1280 기준 출력 크기 자동
        const maxDim = 1280
        if (activeAspect >= 1) { outW = maxDim; outH = Math.round(maxDim / activeAspect) }
        else { outH = maxDim; outW = Math.round(maxDim * activeAspect) }
      }
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, outW, outH)
      onComplete(blob, { crop, zoom })   // 크롭 위치·확대값 함께 반환(위치 조정 재진입용)
    } catch (err) {
      console.error('이미지 crop 실패:', err)
      setError(err.message || '이미지 처리에 실패했어요')
      setProcessing(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={busy ? () => {} : onClose}>
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-1 pr-8">
          {title}
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          {description}
        </p>

        {/* 비율 토글 — aspectOptions 줄 때만 */}
        {aspectOptions && (
          <div className="flex gap-1 p-1 bg-gray-100 rounded-pill mb-4">
            {aspectOptions.map(opt => (
              <button
                key={opt.label}
                type="button"
                onClick={() => { setActiveAspect(opt.value); setCrop({ x: 0, y: 0 }); setZoom(1) }}
                disabled={busy}
                className={`flex-1 py-1.5 text-xs font-medium rounded-pill transition disabled:opacity-50 ${
                  activeAspect === opt.value ? 'bg-white text-brand-deep shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* 크롭 영역 — cropShape 마스크가 곧 저장될 미리보기 */}
        <div className="relative w-full aspect-square bg-gray-900 rounded-2xl overflow-hidden mb-4">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={activeAspect}
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
          {/* 저장될 크롭 사각형에 정확히 겹치는 미리보기 오버레이(페이드 등).
              컨테이너가 정사각형이므로 activeAspect 로 크롭 사각형 위치를 계산.
              aspect>=1 → 폭 100%·높이 1/a, 세로 중앙 / aspect<1 → 높이 100%·폭 a, 가로 중앙. */}
          {cropOverlay && imageSrc && (
            <div
              className="absolute pointer-events-none z-10"
              style={
                activeAspect >= 1
                  ? { left: 0, right: 0, top: `${((1 - 1 / activeAspect) / 2) * 100}%`, height: `${(1 / activeAspect) * 100}%` }
                  : { top: 0, bottom: 0, left: `${((1 - activeAspect) / 2) * 100}%`, width: `${activeAspect * 100}%` }
              }
            >
              {cropOverlay}
            </div>
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

        {/* 보조 액션 — 변경(다른 사진 선택)/삭제 (주어질 때만) */}
        {(onPickNew || onDelete) && (
          <div className="flex gap-2 mb-2">
            {onPickNew && (
              <button type="button" onClick={onPickNew} disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition disabled:opacity-50">
                <Camera className="w-4 h-4" /> 변경
              </button>
            )}
            {onDelete && (
              <button type="button" onClick={onDelete} disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 border border-red-200 text-red-600 text-sm font-medium rounded-md hover:bg-red-50 transition disabled:opacity-50">
                <Trash2 className="w-4 h-4" /> 삭제
              </button>
            )}
          </div>
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
