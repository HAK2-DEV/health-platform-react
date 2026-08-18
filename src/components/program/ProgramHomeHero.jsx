import { useState, useRef } from 'react'
import { ImagePlus, ChevronLeft, Settings } from 'lucide-react'
import ProgramCover from '../common/ProgramCover'
import ImageCropModal from '../common/ImageCropModal'
import { compressImage } from '../../lib/cropImage'
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
  onParticipantsClick = null,  // 「참여자 N명」 클릭 → 명단 모달
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
  const [pendingOriginal, setPendingOriginal] = useState(null)   // 새로 고른 압축 원본(업로드 대기). null=기존 원본 재사용
  const [cropInitial, setCropInitial] = useState({ crop: { x: 0, y: 0 }, zoom: 1 })

  // 새 사진 고르기 — 원본을 압축(용량↓)해서 크롭 소스 + 원본 보관용으로
  const pickFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_SIZE_BYTES || !file.type.startsWith('image/')) return
    try {
      const compressed = await compressImage(file)
      setPendingOriginal(compressed)
      setCropSrc((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(compressed) })
      setCropInitial({ crop: { x: 0, y: 0 }, zoom: 1 })   // 새 사진은 기본 위치에서
      setIsCropOpen(true)
    } catch (err) { console.error('이미지 준비 실패:', err) }
  }
  // 위치 조정 — 다시 고르지 않고 기존 원본 위에서 위치만 재조정(저장된 crop 위치로 열림)
  const openReposition = async () => {
    if (!hero?.originalUrl) { fileRef.current?.click(); return }
    try {
      const res = await fetch(hero.originalUrl)
      const blob = await res.blob()
      setPendingOriginal(null)   // 원본 재사용 — 재업로드 안 함
      setCropSrc((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob) })
      setCropInitial({ crop: { x: hero.crop?.x || 0, y: hero.crop?.y || 0 }, zoom: hero.crop?.zoom || 1 })
      setIsCropOpen(true)
    } catch (err) { console.error('원본 로드 실패:', err); fileRef.current?.click() }
  }
  const closeCrop = () => {
    setIsCropOpen(false)
    setPendingOriginal(null)
    setCropSrc((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
  }
  const onCropDone = async (blob, state) => {
    setUploading(true)
    try {
      let originalUrl = hero?.originalUrl || null
      if (pendingOriginal) {   // 새로 고른 경우만 압축 원본 업로드
        const opath = `${ownerId || 'anon'}/hero-orig-${Date.now()}.jpg`
        const { error: oErr } = await supabase.storage.from('program-covers').upload(opath, pendingOriginal, { upsert: false, contentType: 'image/jpeg' })
        if (oErr) throw oErr
        originalUrl = supabase.storage.from('program-covers').getPublicUrl(opath).data.publicUrl
      }
      const path = `${ownerId || 'anon'}/hero-${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from('program-covers').upload(path, blob, { upsert: false, contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('program-covers').getPublicUrl(path)
      onHeroChange?.({
        ...(hero || {}),
        imageUrl: data.publicUrl,
        originalUrl,
        crop: { x: state?.crop?.x || 0, y: state?.crop?.y || 0, zoom: state?.zoom || 1 },
        useImage: true,
      })
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
        {/* ① 커버 — 살짝 워시. 커버 변경은 상단 「커버 변경」 버튼으로만(전체 탭 제거 → 뒤로·설정 오탭 방지) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ filter: 'saturate(.85) contrast(.94) brightness(.98)' }}
        >
          {bgUrl
            ? <img src={bgUrl} alt="" className="w-full h-full object-cover" />
            : <ProgramCover imagePath={coverImagePath} categories={categories} name={programName} variant="hero" className="!absolute inset-0 !aspect-auto w-full h-full !rounded-none" />}
        </div>

        {/* ② 상단 스크림 (상태바 가독성) — 안전영역만큼 더 내려옴 */}
        <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: `calc(70px + ${safeTop})`, background: 'linear-gradient(180deg,rgba(24,21,16,.42),rgba(24,21,16,0))' }} />
        {/* ③ 하단 밝은 페이드 (이미지 → 시트 배경색으로 녹임) */}
        <div className="absolute inset-x-0 bottom-0 h-[150px] pointer-events-none" style={{ background: `linear-gradient(180deg,${SHEET_BG}00,${SHEET_BG} 70%)` }} />

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
        {/* 커버 변경 버튼 (운영자) — 이 버튼으로만 사진 선택 (커버 전체 탭 제거) */}
        {editable && (
          <button type="button" onClick={() => (bgUrl && hero?.originalUrl) ? openReposition() : fileRef.current?.click()} disabled={uploading}
            className="absolute left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1 text-[11px] font-bold text-white bg-black/40 hover:bg-black/55 active:bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm shadow-sm transition disabled:opacity-60"
            style={{ top: `calc(0.85rem + ${safeTop})` }}>
            <ImagePlus className="w-3.5 h-3.5" /> {uploading ? '업로드 중…' : '커버 변경'}
          </button>
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
            {onParticipantsClick ? (
              <button type="button" onClick={onParticipantsClick}
                className="pointer-events-auto underline underline-offset-2 decoration-gray-400 hover:text-emerald-700 transition">참여자 {participantCount ?? 0}명</button>
            ) : (
              <>참여자 {participantCount ?? 0}명</>
            )}
            {ownerName ? ` · 운영 ${ownerName}` : ''}
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
        initialCrop={cropInitial.crop}
        initialZoom={cropInitial.zoom}
        onPickNew={() => fileRef.current?.click()}
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
            <div className="absolute inset-x-0 bottom-0" style={{ height: `${(150 / HERO_H) * 100}%`, background: `linear-gradient(180deg,${SHEET_BG}00,${SHEET_BG} 70%)` }} />
          </>
        }
      />
    </>
  )
}

export default ProgramHomeHero
