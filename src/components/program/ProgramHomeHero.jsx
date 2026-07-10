import { useState, useRef, useEffect } from 'react'
import { Pencil, ImagePlus, X } from 'lucide-react'
import ProgramCover from '../common/ProgramCover'
import ImageCropModal from '../common/ImageCropModal'
import HeroGradientEditor, { buildGradient, normalizeGradient } from './HeroGradientEditor'
import { supabase } from '../../supabaseClient'

// 카드홈 편집형 히어로 — 달리기 히어로처럼 리치 편집(크기·색·볼드) + 배경 사진 + 그라데이션.
//   config(home_hero) = { titleHtml, subtitleHtml, useImage, gradient(0~100), imageUrl(운영자 업로드) }
//   기본(config 없음) = 프로그램명 제목 + 사진 없음(글자만, 낮은 박스).
//   사진 모드: 좌→우 흰색 그라데이션(글자는 좌측·어두운 색) — imageUrl 없으면 표지 재활용.

const HERO_TITLE_SIZES = [
  { key: 'sm', label: '작게', px: 18 },
  { key: 'md', label: '보통', px: 22 },
  { key: 'lg', label: '크게', px: 26 },
  { key: 'xl', label: '아주', px: 30 },
]
const HERO_SUB_SIZES = [
  { key: 'sm', label: '작게', px: 12 },
  { key: 'md', label: '보통', px: 14 },
  { key: 'lg', label: '크게', px: 16 },
]
// 어두운 색 위주(사진 위 흰 그라데이션 + 좌측 글자) + 흰색도 선택 가능
const HERO_PALETTE = ['#111827', '#374151', '#6B7280', '#059669', '#0EA5E9', '#D97706', '#E11D48', '#7C3AED', '#FFFFFF']
const sizePx = (list, key, fb) => (list.find((s) => s.key === key)?.px ?? fb)

// 히어로 배너 비율(카드 폭 ≈ 398 / 높이 150 ≈ 2.65) — 크롭 결과가 곧 렌더 영역
const HERO_ASPECT = 398 / 150
const MAX_SIZE_BYTES = 10 * 1024 * 1024

// ── HTML 새니타이즈 (참여자에게도 렌더 → XSS 방지: span[color/size/weight]/br/텍스트만) ──
const _HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const _RGB = /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i
function safeColor(v) { const c = String(v || '').trim().toLowerCase(); return _HEX.test(c) || _RGB.test(c) ? c : null }
function safeFontSize(v) { const s = String(v || '').trim().toLowerCase(); return /^\d{1,3}px$/.test(s) ? s : null }
function safeFontWeight(v) { const s = String(v || '').trim().toLowerCase(); if (s === 'bold') return '800'; if (s === 'normal') return '400'; return /^[1-9]00$/.test(s) ? s : null }
const _esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function sanitizeHeroHtml(html) {
  if (!html || typeof document === 'undefined') return ''
  const tpl = document.createElement('template')
  tpl.innerHTML = String(html).slice(0, 4000)
  let out = ''
  const walk = (node) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) out += _esc(n.nodeValue)
      else if (n.nodeType === 1) {
        const tag = n.tagName.toLowerCase()
        if (tag === 'br') { out += '<br>'; return }
        if (tag === 'div') { if (out && !out.endsWith('<br>')) out += '<br>'; walk(n); return }
        if (tag === 'span' || tag === 'font') {
          const st = []
          const col = safeColor(n.style?.color || n.getAttribute('color')); if (col) st.push(`color:${col}`)
          const fs = safeFontSize(n.style?.fontSize); if (fs) st.push(`font-size:${fs}`)
          const fw = safeFontWeight(n.style?.fontWeight); if (fw) st.push(`font-weight:${fw}`)
          if (st.length) { out += `<span style="${st.join(';')}">`; walk(n); out += '</span>'; return }
          walk(n); return
        }
        if (tag === 'b' || tag === 'strong') { out += '<span style="font-weight:800">'; walk(n); out += '</span>'; return }
        walk(n)
      }
    })
  }
  walk(tpl.content)
  return out
}
function plainToHtml(text, color) { const h = _esc(text).replace(/\n/g, '<br>'); const col = safeColor(color); return col ? `<span style="color:${col}">${h}</span>` : h }

// 선택 영역 단위 크기·볼드·색 지정 (contentEditable)
//   maxLines: 주면 그 줄 수를 초과하는 입력(줄바꿈·자동 줄바꿈)을 막고 박스 높이도 고정
function RichField({ initialHtml, baseFontSize, baseFontWeight, baseColor, sizes, onChange, maxLines = null, padX = 'px-2' }) {
  const ref = useRef(null)
  const lastValid = useRef(initialHtml || '')
  useEffect(() => { if (ref.current) { ref.current.innerHTML = initialHtml || ''; lastValid.current = initialHtml || '' } }, [])
  const caretEnd = () => {
    const el = ref.current; if (!el) return
    const sel = window.getSelection(); const r = document.createRange()
    r.selectNodeContents(el); r.collapse(false); sel.removeAllRanges(); sel.addRange(r)
  }
  const emit = () => {
    const el = ref.current; if (!el) return
    // maxLines 초과(스크롤 발생) → 직전 유효 상태로 되돌림
    if (maxLines && el.scrollHeight > el.clientHeight + 2) {
      el.innerHTML = lastValid.current; caretEnd(); return
    }
    lastValid.current = el.innerHTML
    onChange?.(sanitizeHeroHtml(el.innerHTML))
  }
  const applyStyle = (styleObj) => {
    const el = ref.current
    if (!el) return
    if (document.activeElement !== el) el.focus()
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    if (!el.contains(range.commonAncestorContainer)) return
    const span = document.createElement('span')
    Object.assign(span.style, styleObj)
    try { range.surroundContents(span) }
    catch { const frag = range.extractContents(); span.appendChild(frag); range.insertNode(span) }
    sel.removeAllRanges()
    const r = document.createRange(); r.selectNodeContents(span); sel.addRange(r)
    emit()
  }
  const toggleBold = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    let node = sel.anchorNode
    if (node && node.nodeType === 3) node = node.parentElement
    const cur = node ? parseInt(window.getComputedStyle(node).fontWeight, 10) || 400 : 400
    applyStyle({ fontWeight: cur >= 600 ? '400' : '800' })
  }
  const md = (fn) => (e) => { e.preventDefault(); fn() }
  return (
    <>
      <div ref={ref} contentEditable suppressContentEditableWarning onInput={emit} onBlur={emit}
        className={`mt-1 w-full ${padX} py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400 leading-snug break-keep`}
        style={maxLines
          ? { fontSize: baseFontSize, fontWeight: baseFontWeight, color: baseColor, whiteSpace: 'pre-wrap', height: Math.round(baseFontSize * 1.5) * maxLines + 12, overflow: 'hidden' }
          : { fontSize: baseFontSize, fontWeight: baseFontWeight, color: baseColor, whiteSpace: 'pre-wrap', minHeight: 34 }} />
      <p className="text-[10px] text-gray-400 mt-1">🎨 글자를 드래그로 선택한 뒤 크기·B·색을 누르면 그 부분만 적용돼요</p>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        <div className="flex rounded-md border border-gray-200 overflow-hidden">
          {sizes.map((s) => (
            <button key={s.key} type="button" onMouseDown={md(() => applyStyle({ fontSize: `${s.px}px` }))}
              className="px-2 h-7 text-[11px] font-bold bg-white text-gray-500 hover:bg-gray-50">{s.label}</button>
          ))}
        </div>
        <button type="button" onMouseDown={md(toggleBold)}
          className="w-7 h-7 rounded-md border border-gray-200 bg-white text-gray-600 text-[13px] font-extrabold hover:bg-gray-50">B</button>
        <div className="flex items-center gap-1">
          {HERO_PALETTE.map((c) => (
            <button key={c} type="button" onMouseDown={md(() => applyStyle({ color: c }))} aria-label={c}
              className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
    </>
  )
}

function ProgramHomeHero({ hero, editable = false, coverImagePath = null, categories = [], programName = '', ownerId = null, onHeroChange = null }) {
  const useImage = hero?.useImage === true
  const gradObj = normalizeGradient(hero?.gradient, hero?.gradientStart)
  const bgUrl = hero?.imageUrl || null
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ titleHtml: '', subtitleHtml: '', useImage: false, gradient: normalizeGradient(null), imageUrl: null })
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))

  // 사진 업로드/크롭
  const fileRef = useRef(null)
  const [cropSrc, setCropSrc] = useState(null)
  const [isCropOpen, setIsCropOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  // 표시용 HTML — 없으면 프로그램명 기반 기본
  const titleHtml = hero?.titleHtml != null ? hero.titleHtml : plainToHtml(programName || '프로그램')
  const subHtml = hero?.subtitleHtml != null ? hero.subtitleHtml : ''
  // 사진 모드=좌측 어두운 글자(흰 그라데이션 위) / 텍스트 모드=진회색
  const baseTitleColor = '#111827'
  const baseSubColor = useImage ? '#374151' : '#6B7280'

  const open = () => {
    setUploadError(null)
    setDraft({
      titleHtml: hero?.titleHtml != null ? hero.titleHtml : plainToHtml(programName || '프로그램'),
      subtitleHtml: hero?.subtitleHtml != null ? hero.subtitleHtml : '',
      useImage,
      gradient: gradObj,
      imageUrl: bgUrl,
    })
    setEditing(true)
  }
  const save = () => {
    onHeroChange?.({
      titleHtml: sanitizeHeroHtml(draft.titleHtml),
      subtitleHtml: sanitizeHeroHtml(draft.subtitleHtml),
      useImage: draft.useImage,
      gradient: normalizeGradient(draft.gradient),
      imageUrl: draft.imageUrl || null,
    })
    setEditing(false)
  }

  const pickFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_SIZE_BYTES) { setUploadError('이미지가 너무 커요 (최대 10MB)'); return }
    if (!file.type.startsWith('image/')) { setUploadError('이미지 파일만 올릴 수 있어요'); return }
    setUploadError(null)
    setCropSrc(URL.createObjectURL(file))
    setIsCropOpen(true)
  }
  const closeCrop = () => {
    setIsCropOpen(false)
    setCropSrc((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
  }
  const onCropDone = async (blob) => {
    setUploading(true); setUploadError(null)
    try {
      const path = `${ownerId || 'anon'}/hero-${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from('program-covers').upload(path, blob, { upsert: false, contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('program-covers').getPublicUrl(path)
      setDraft((d) => ({ ...d, imageUrl: data.publicUrl, useImage: true }))
      closeCrop()
    } catch (err) {
      console.error('히어로 배경 업로드 실패:', err)
      setUploadError(err.message || '업로드에 실패했어요')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      {useImage ? (
        // 사진 배경 + 좌→우 흰 그라데이션 + 좌측 글자 — 박스 크기 고정(h-[122px])
        <div className="relative rounded-2xl overflow-hidden shadow-soft h-[122px] flex flex-col justify-center">
          {bgUrl
            ? <img src={bgUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            : <ProgramCover imagePath={coverImagePath} categories={categories} name={programName} variant="hero" className="!absolute inset-0 !aspect-auto w-full h-full !rounded-none" />}
          <div className="absolute inset-0" style={{ background: buildGradient(gradObj) }} />
          {editable && (
            <button type="button" onClick={open} className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-black/25 text-white/90 flex items-center justify-center hover:bg-black/45 transition" aria-label="히어로 편집">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="relative px-4 py-4 max-w-[72%]">
            <h1 className="leading-snug break-keep"
              style={{ fontSize: sizePx(HERO_TITLE_SIZES, null, 26), fontWeight: 800, color: baseTitleColor }}
              dangerouslySetInnerHTML={{ __html: sanitizeHeroHtml(titleHtml) }} />
            {subHtml && (
              <p className="break-keep" style={{ fontSize: sizePx(HERO_SUB_SIZES, null, 14), color: baseSubColor, marginTop: 6 }}
                dangerouslySetInnerHTML={{ __html: sanitizeHeroHtml(subHtml) }} />
            )}
          </div>
        </div>
      ) : (
        // 텍스트 전용 — 박스 고정(h-[122px]) · 위 정렬 · 여백 축소
        <div className="relative rounded-2xl px-4 py-3.5 bg-white border border-gray-100 shadow-soft h-[122px] overflow-hidden flex flex-col justify-start">
          {editable && (
            <button type="button" onClick={open} className="absolute top-3 right-3 text-gray-300 hover:text-emerald-500 transition" aria-label="히어로 편집">
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <h1 className="leading-snug break-keep pr-7"
            style={{ fontSize: sizePx(HERO_TITLE_SIZES, null, 26), fontWeight: 800, color: baseTitleColor }}
            dangerouslySetInnerHTML={{ __html: sanitizeHeroHtml(titleHtml) }} />
          {subHtml && (
            <p className="break-keep" style={{ fontSize: sizePx(HERO_SUB_SIZES, null, 14), color: baseSubColor, marginTop: 4 }}
              dangerouslySetInnerHTML={{ __html: sanitizeHeroHtml(subHtml) }} />
          )}
        </div>
      )}

      {/* 편집 모달 (사진 크롭 모달보다 아래 z-50) */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: 'rgba(15,23,42,0.45)' }} onClick={() => setEditing(false)}>
          <div className="w-full max-w-[340px] max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-gray-800">히어로 편집</h3>
            <div>
              <label className="block text-[13px] font-bold text-gray-700 mb-0.5">제목</label>
              <RichField initialHtml={draft.titleHtml} baseFontSize={26} baseFontWeight={800} baseColor="#111827"
                sizes={HERO_TITLE_SIZES} maxLines={2} padX="px-4" onChange={(h) => set('titleHtml', h)} />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-gray-700 mb-0.5">부제</label>
              <RichField initialHtml={draft.subtitleHtml} baseFontSize={14} baseFontWeight={500} baseColor="#6B7280"
                sizes={HERO_SUB_SIZES} padX="px-4" onChange={(h) => set('subtitleHtml', h)} />
            </div>
            {/* 배경 사진 */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-[13px] font-bold text-gray-700">배경 사진</p>
                <p className="text-[11px] text-gray-400">사진을 올리면 글자와 함께 보여요</p>
              </div>
              <button type="button" onClick={() => set('useImage', !draft.useImage)}
                className={`w-11 h-6 rounded-full transition relative ${draft.useImage ? 'bg-emerald-500' : 'bg-gray-300'}`} aria-label="배경 사진 토글">
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${draft.useImage ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>

            {draft.useImage && (
              <>
                {/* 사진 올리기 / 편집 */}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-200 text-gray-600 text-[12px] font-bold hover:border-emerald-400 hover:text-emerald-600 transition disabled:opacity-50">
                    <ImagePlus className="w-4 h-4" /> {draft.imageUrl ? '사진 변경' : '사진 올리기'}
                  </button>
                  {draft.imageUrl && (
                    <button type="button" onClick={() => set('imageUrl', null)} disabled={uploading}
                      className="inline-flex items-center gap-1 px-2 h-9 rounded-lg text-gray-400 text-[12px] hover:text-red-500 transition disabled:opacity-50">
                      <X className="w-3.5 h-3.5" /> 표지로
                    </button>
                  )}
                  {uploading && <span className="text-[11px] text-gray-400">업로드 중…</span>}
                </div>
                {!draft.imageUrl && <p className="text-[10px] text-gray-400 -mt-1">사진을 안 올리면 프로그램 표지가 배경이 돼요.</p>}
                {uploadError && <p className="text-[11px] text-red-500">{uploadError}</p>}
                <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} className="hidden" />

                {/* 그라데이션 편집기 (중지점·색·불투명도·방향) */}
                <div>
                  <label className="block text-[13px] font-bold text-gray-700 mb-1">그라데이션</label>
                  <HeroGradientEditor value={draft.gradient} onChange={(gg) => set('gradient', gg)} />
                  <p className="text-[10px] text-gray-400 mt-1.5">중지점을 추가·이동하고 색·불투명도를 조절하세요. 글자 쪽을 흰색·불투명(100%)으로 두면 사진이 안 비쳐요.</p>
                </div>
              </>
            )}

            {/* 미리보기 — 항상 표시(줄바꿈·색·사진 실시간 반영). 실제 렌더와 동일 */}
            <div>
              <p className="text-[11px] font-bold text-gray-400 mb-1">미리보기</p>
              {draft.useImage ? (
                <div className="relative rounded-2xl overflow-hidden shadow-soft h-[122px] flex flex-col justify-center">
                  {draft.imageUrl
                    ? <img src={draft.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    : <ProgramCover imagePath={coverImagePath} categories={categories} name={programName} variant="hero" className="!absolute inset-0 !aspect-auto w-full h-full !rounded-none" />}
                  <div className="absolute inset-0" style={{ background: buildGradient(draft.gradient) }} />
                  <div className="relative px-4 py-4 max-w-[72%]">
                    <h1 className="leading-snug break-keep" style={{ fontSize: 26, fontWeight: 800, color: '#111827' }}
                      dangerouslySetInnerHTML={{ __html: sanitizeHeroHtml(draft.titleHtml) }} />
                    {draft.subtitleHtml && (
                      <p className="break-keep" style={{ fontSize: 14, color: '#374151', marginTop: 6 }}
                        dangerouslySetInnerHTML={{ __html: sanitizeHeroHtml(draft.subtitleHtml) }} />
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative rounded-2xl px-4 py-3.5 bg-white border border-gray-100 shadow-soft h-[122px] overflow-hidden flex flex-col justify-start">
                  <h1 className="leading-snug break-keep" style={{ fontSize: 26, fontWeight: 800, color: '#111827' }}
                    dangerouslySetInnerHTML={{ __html: sanitizeHeroHtml(draft.titleHtml) }} />
                  {draft.subtitleHtml && (
                    <p className="break-keep" style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}
                      dangerouslySetInnerHTML={{ __html: sanitizeHeroHtml(draft.subtitleHtml) }} />
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setEditing(false)} className="flex-1 h-10 rounded-lg border border-gray-200 text-gray-500 text-[14px] font-bold">취소</button>
              <button type="button" onClick={save} className="flex-[1.4] h-10 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-bold transition">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 배경 사진 크롭 — 히어로 배너 비율 (z-[60], 편집 모달 위) */}
      <ImageCropModal
        isOpen={isCropOpen}
        imageSrc={cropSrc}
        onClose={closeCrop}
        onComplete={onCropDone}
        isUploading={uploading}
        aspect={HERO_ASPECT}
        cropShape="rect"
        outputWidth={1200}
        outputHeight={Math.round(1200 / HERO_ASPECT)}
        minZoom={0.3}
        title="배경 사진 편집"
        description="히어로에 보일 영역을 맞춰주세요 (드래그·확대)"
      />
    </>
  )
}

export default ProgramHomeHero
