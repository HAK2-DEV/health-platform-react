import { useState, useRef } from 'react'
import { ImagePlus, ChevronLeft, Settings } from 'lucide-react'
import ProgramCover from '../common/ProgramCover'
import ImageCropModal from '../common/ImageCropModal'
import { supabase } from '../../supabaseClient'

// 프로그램 개요 히어로 (커버 사진형) — 데모 2026-07 기준.
//   구조: 전체폭 커버(252px, 살짝 워시) + 상단 스크림 + 하단 밝은 페이드(배경색으로 녹임)
//         + 타이틀 블록(진행중 배지 · 여정 · 프로그램명 27px · 참여자/운영자).
//   운영자: 커버를 탭 → 크롭 → 업로드(home_hero.imageUrl). 사진 없으면 ProgramCover 폴백.
//   ※ 콘텐츠 시트(-22px 겹침·26px 라운드)는 ProgramHome 에서 감쌈.

const HERO_H = 252
const SHEET_BG = '#fdfbf7'
const HERO_ASPECT = 390 / HERO_H        // 커버 크롭 비율(≈1.55)
const MAX_SIZE_BYTES = 10 * 1024 * 1024

function ProgramHomeHero({
  hero = null,
  editable = false,
  coverImagePath = null,
  categories = [],
  programName = '',
  statusLabel = '진행중',
  participantCount = null,
  journeyText = '',
  ownerName = null,
  ownerId = null,
  onHeroChange = null,
  onBack = null,               // immersive — 히어로 위 뒤로가기
  onSettings = null,           // immersive — 운영자 설정(메뉴)
  pendingCount = 0,
}) {
  const bgUrl = hero?.imageUrl || null
  const fileRef = useRef(null)
  const [cropSrc, setCropSrc] = useState(null)
  const [isCropOpen, setIsCropOpen] = useState(false)
  const [uploading, setUploading] = useState(false)

  const pickFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_SIZE_BYTES || !file.type.startsWith('image/')) return
    setCropSrc(URL.createObjectURL(file))
    setIsCropOpen(true)
  }
  const closeCrop = () => {
    setIsCropOpen(false)
    setCropSrc((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
  }
  const onCropDone = async (blob) => {
    setUploading(true)
    try {
      const path = `${ownerId || 'anon'}/hero-${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from('program-covers').upload(path, blob, { upsert: false, contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('program-covers').getPublicUrl(path)
      onHeroChange?.({ ...(hero || {}), imageUrl: data.publicUrl, useImage: true })
      closeCrop()
    } catch (err) {
      console.error('히어로 커버 업로드 실패:', err)
    } finally {
      setUploading(false)
    }
  }

  const safeTop = 'env(safe-area-inset-top, 0px)'   // 노치/상태바 안전영역
  return (
    <>
      {/* 상태바 밑까지 커버가 채워지도록 높이에 safe-area 더함(위쪽으로 확장) */}
      <div className="relative" style={{ height: `calc(${HERO_H}px + ${safeTop})` }}>
        {/* ① 커버 — 살짝 워시. 운영자는 탭하면 커버 업로드 */}
        <div
          className={`absolute inset-0 overflow-hidden ${editable ? 'cursor-pointer' : ''}`}
          style={{ filter: 'saturate(.85) contrast(.94) brightness(.98)' }}
          onClick={editable && !uploading ? () => fileRef.current?.click() : undefined}
        >
          {bgUrl
            ? <img src={bgUrl} alt="" className="w-full h-full object-cover" />
            : <ProgramCover imagePath={coverImagePath} categories={categories} name={programName} variant="hero" className="!absolute inset-0 !aspect-auto w-full h-full !rounded-none" />}
        </div>

        {/* ② 상단 스크림 (상태바 가독성) — 안전영역만큼 더 내려옴 */}
        <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: `calc(70px + ${safeTop})`, background: 'linear-gradient(180deg,rgba(24,21,16,.42),rgba(24,21,16,0))' }} />
        {/* ③ 하단 밝은 페이드 (이미지 → 시트 배경색으로 녹임) */}
        <div className="absolute inset-x-0 bottom-0 h-[200px] pointer-events-none" style={{ background: `linear-gradient(180deg,${SHEET_BG}00,${SHEET_BG} 46%)` }} />

        {/* 뒤로가기 (좌상단, 상태바 아래) */}
        {onBack && (
          <button type="button" onClick={onBack} aria-label="뒤로"
            className="absolute left-4 z-20 w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm shadow-md flex items-center justify-center hover:bg-white transition"
            style={{ top: `calc(0.75rem + ${safeTop})` }}>
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
        )}
        {/* 설정 (우상단, 운영자) */}
        {onSettings && (
          <button type="button" onClick={onSettings} aria-label="운영자 메뉴"
            className="absolute right-4 z-20 w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm shadow-md flex items-center justify-center hover:bg-white transition"
            style={{ top: `calc(0.75rem + ${safeTop})` }}>
            <Settings className="w-[18px] h-[18px] text-gray-700" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>
        )}
        {/* 커버 변경 힌트 (운영자) */}
        {editable && (
          <span className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none inline-flex items-center gap-1 text-[10.5px] font-bold text-white bg-black/32 px-2 py-1 rounded-full backdrop-blur-sm"
            style={{ top: `calc(0.95rem + ${safeTop})` }}>
            <ImagePlus className="w-3 h-3" /> {uploading ? '업로드 중…' : '탭해서 커버 변경'}
          </span>
        )}

        {/* 타이틀 블록 (밝은 페이드 위, 어두운 텍스트) */}
        <div className="absolute left-5 right-5 bottom-8 pointer-events-none">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              <span className="text-[7px]">●</span>{statusLabel}
            </span>
            {journeyText && <span className="text-[11.5px] font-semibold text-gray-600">{journeyText}</span>}
          </div>
          <h1 className="text-[27px] font-extrabold text-gray-900 leading-[1.16] tracking-[-.02em] break-keep">{programName}</h1>
          <p className="text-[12.5px] font-semibold text-gray-600 mt-1.5">
            참여자 {participantCount ?? 0}명{ownerName ? ` · 운영 ${ownerName}` : ''}
          </p>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} className="hidden" />
      <ImageCropModal
        isOpen={isCropOpen}
        imageSrc={cropSrc}
        onClose={closeCrop}
        onComplete={onCropDone}
        isUploading={uploading}
        aspect={HERO_ASPECT}
        cropShape="rect"
        outputWidth={1170}
        outputHeight={Math.round(1170 / HERO_ASPECT)}
        minZoom={0.3}
        title="커버 사진 편집"
        description="개요 화면 맨 위에 보일 영역을 맞춰주세요 (드래그·확대)"
        cropOverlay={
          <>
            {/* 실제 개요와 동일 비율의 상단 스크림(70/252) + 하단 밝은 페이드(200/252) */}
            <div className="absolute inset-x-0 top-0" style={{ height: `${(70 / HERO_H) * 100}%`, background: 'linear-gradient(180deg,rgba(24,21,16,.42),rgba(24,21,16,0))' }} />
            <div className="absolute inset-x-0 bottom-0" style={{ height: `${(200 / HERO_H) * 100}%`, background: `linear-gradient(180deg,${SHEET_BG}00,${SHEET_BG} 46%)` }} />
          </>
        }
      />
    </>
  )
}

export default ProgramHomeHero
