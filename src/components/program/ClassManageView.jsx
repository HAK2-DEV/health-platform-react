import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useKeyboardInset } from '../../hooks/useKeyboardInset'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { Plus, Calendar, MapPin, Users, Pencil, Trash2, Copy, X, ChevronDown, ChevronUp, Camera, Loader2 } from 'lucide-react'
import { CLASS_CAT_LIST, catOf } from '../../lib/classCategories'
import ConfirmModal from '../common/ConfirmModal'
import ImageCropModal from '../common/ImageCropModal'
import { supabase } from '../../supabaseClient'

// 강사 프로필 사진 공개 URL (program-covers 공개 버킷)
const instrPhotoUrl = (path) => path ? supabase.storage.from('program-covers').getPublicUrl(path).data?.publicUrl : null

// 운영자 「클래스 관리」 — 프레젠테이션 뷰(데모/실배선 공용).
//   props: instructors, sessions, handlers, busy. 폼 상태는 내부 로컬.
const WD = ['일', '월', '화', '수', '목', '금', '토']
const dLabel = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})` }
const tLabel = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[12px] font-bold text-gray-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}
const inputCls = 'w-full h-10 px-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-400'

// 종목 선택 — 아이콘 표시용 커스텀 드롭다운(native select 는 이미지 불가). 인라인 확장(모달 클리핑 회피).
const catBadge = (c, size) => c.icon
  ? <img src={c.icon} alt="" aria-hidden="true" className="object-contain flex-shrink-0" style={{ width: size, height: size }} />
  : <span>{c.emoji}</span>
function CategorySelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const cur = catOf(value)
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} className={`${inputCls} flex items-center justify-between text-left`}>
        <span className="flex items-center gap-1.5">{catBadge(cur, 18)} {cur.label}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="mt-1 rounded-lg border border-gray-200 overflow-hidden">
          {CLASS_CAT_LIST.map(c => (
            <button key={c.key} type="button" onClick={() => { onChange(c.key); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-2.5 h-10 text-left text-[13px] transition ${c.key === value ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}>
              {catBadge(c, 20)} {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 강사 폼 모달 ──
function InstructorForm({ initial, onSave, onClose, busy }) {
  const [name, setName] = useState(initial?.name || '')
  const [specialty, setSpecialty] = useState(initial?.specialty || '')
  const [bio, setBio] = useState(initial?.bio || '')
  const [photoPath, setPhotoPath] = useState(initial?.photo_path || null)
  const [cropSrc, setCropSrc] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const photoUrl = instrPhotoUrl(photoPath)

  const [photoErr, setPhotoErr] = useState(null)
  const uploadedRef = useRef(null)   // 이번 세션 임시 업로드 파일(저장 전 교체·취소 시 정리)

  const onPick = (e) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) { setPhotoErr('이미지 파일만 올릴 수 있어요'); return }
    if (f.size > 10 * 1024 * 1024) { setPhotoErr('파일 크기는 10MB 이하여야 해요'); return }
    setPhotoErr(null)
    setCropSrc(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f) })
  }
  const closeCrop = () => setCropSrc(prev => { if (prev) URL.revokeObjectURL(prev); return null })
  const onCropDone = async (blob) => {
    setUploading(true); setPhotoErr(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const newPath = `${user?.id}/instructor-${Date.now()}.jpg`
      const { error } = await supabase.storage.from('program-covers').upload(newPath, blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      // 이번 세션에 올렸던 이전 임시 파일만 정리 (초기 DB 파일은 저장 전이라 보존)
      if (uploadedRef.current && uploadedRef.current !== newPath) supabase.storage.from('program-covers').remove([uploadedRef.current]).catch(() => {})
      uploadedRef.current = newPath
      setPhotoPath(newPath)
    } catch (err) { console.error('강사 사진 업로드 실패:', err); setPhotoErr('사진 업로드에 실패했어요') }
    finally { setUploading(false); closeCrop() }
  }
  const removePhoto = () => {
    if (uploadedRef.current) { supabase.storage.from('program-covers').remove([uploadedRef.current]).catch(() => {}); uploadedRef.current = null }
    setPhotoPath(null)
  }
  // 아바타 탭 — 사진 있으면 현재 사진을 크롭 모달로 편집(원격→blob), 없으면 파일 선택
  const [adjustLoading, setAdjustLoading] = useState(false)
  const handleAvatarTap = async () => {
    if (!photoPath) { fileRef.current?.click(); return }
    setAdjustLoading(true); setPhotoErr(null)
    try {
      const res = await fetch(`${photoUrl}?t=${Date.now()}`)   // 캐시버스터 → 신선한 CORS 응답
      if (!res.ok) throw new Error('불러오기 실패')
      const blob = await res.blob()
      setCropSrc(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob) })
    } catch (e) { console.error('사진 편집용 로드 실패:', e); setPhotoErr('사진을 불러오지 못했어요') }
    finally { setAdjustLoading(false) }
  }
  const save = () => { if (!name.trim()) return; onSave({ name: name.trim(), specialty: specialty.trim() || null, bio: bio.trim() || null, photo_path: photoPath }) }

  return (
    <Overlay onClose={onClose} title={initial ? '강사 수정' : '강사 추가'}>
      {/* 프로필 사진 — 마이페이지 아바타와 동일: 탭하면 현재 사진 편집(변경/삭제) 모달 */}
      <div className="flex flex-col items-center gap-1.5 mb-1">
        <div className="relative">
          <button type="button" onClick={handleAvatarTap} disabled={uploading || adjustLoading}
            className="block rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-70"
            aria-label={photoPath ? '프로필 사진 편집' : '프로필 사진 추가'} title={photoPath ? '편집' : '사진 추가'}>
            <div className="w-20 h-20 rounded-full overflow-hidden bg-emerald-100 flex items-center justify-center ring-2 ring-white shadow-sm">
              {photoUrl
                ? <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                : <span className="text-2xl font-bold text-emerald-700">{(name || '?')[0]}</span>}
            </div>
          </button>
          {(uploading || adjustLoading) && <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center pointer-events-none"><Loader2 className="w-6 h-6 text-white animate-spin" /></div>}
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || adjustLoading}
            className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white rounded-full shadow-md flex items-center justify-center transition disabled:opacity-50" title="프로필 사진 변경">
            <Camera className="w-3.5 h-3.5" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
        </div>
        {photoPath && !uploading && !adjustLoading && (
          <button type="button" onClick={removePhoto} className="text-[11px] text-gray-400 hover:text-red-500 transition">사진 삭제</button>
        )}
        {photoErr && <p className="text-[11px] text-red-500">{photoErr}</p>}
      </div>
      <Field label="이름 *"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="예: 김서연" /></Field>
      <Field label="전문 · 경력"><input className={inputCls} value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="예: 요가 지도자 · 8년" /></Field>
      <Field label="소개"><textarea className={`${inputCls} h-20 py-2 resize-none`} value={bio} onChange={e => setBio(e.target.value)} placeholder="강사 소개를 적어주세요" /></Field>
      <FormButtons onClose={onClose} onSave={save} busy={busy || uploading} disabled={!name.trim()} />
      {cropSrc && (
        <ImageCropModal isOpen imageSrc={cropSrc} onClose={closeCrop} onComplete={onCropDone}
          aspect={1} cropShape="round" outputWidth={512} outputHeight={512}
          title="프로필 사진 편집" description="원 안에서 드래그하고 확대·축소해 위치를 맞춰주세요"
          isUploading={uploading}
          onPickNew={() => fileRef.current?.click()}
          onDelete={photoPath ? () => { closeCrop(); removePhoto() } : undefined} />
      )}
    </Overlay>
  )
}

// ── 클래스 폼 모달 (신규/편집) ──
const pad2 = (n) => String(n).padStart(2, '0')
const toDateInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
const toTimeInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }
// 클래스 추가/수정 — 무스크롤 단계별 위저드 (미션/퀴즈 마법사와 동일 UX)
const SESSION_STEPS = ['기본 정보', '일정', '장소', '신청 · 점수', '안내']
const stepSlide = {
  enter: (d) => ({ x: d > 0 ? 28 : -28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d) => ({ x: d > 0 ? -28 : 28, opacity: 0 }),
}
function SessionForm({ instructors, initial, isEdit = false, onSave, onClose, busy }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [category, setCategory] = useState(initial?.category || 'yoga')
  const [instructorId, setInstructorId] = useState(initial?.instructor_id ?? instructors[0]?.id ?? '')
  const [date, setDate] = useState(toDateInput(initial?.starts_at) || '')
  const [start, setStart] = useState(toTimeInput(initial?.starts_at) || '19:00')
  const [end, setEnd] = useState(toTimeInput(initial?.ends_at) || (initial ? '' : '20:00'))
  const [placeName, setPlaceName] = useState(initial?.place_name || '')
  const [placeAddr, setPlaceAddr] = useState(initial?.place_address || '')
  const [capacity, setCapacity] = useState(initial?.capacity != null ? String(initial.capacity) : '')
  const [signup, setSignup] = useState(initial?.signup_mode || 'rsvp')
  const [points, setPoints] = useState(initial?.points != null ? String(initial.points) : '0')
  const [desc, setDesc] = useState(initial?.description || '')

  const [step, setStep] = useState(1)
  const [dir, setDir] = useState(1)
  const TOTAL = SESSION_STEPS.length

  const canSave = title.trim() && date && start
  //  1단계=제목 필수, 2단계=날짜·시작 필수. 나머지 단계는 선택이라 통과 가능.
  const stepValid = (s) => s === 1 ? !!title.trim() : s === 2 ? (!!date && !!start) : true
  const goNext = () => { if (stepValid(step)) { setDir(1); setStep(s => Math.min(TOTAL, s + 1)) } }
  const goPrev = () => { setDir(-1); setStep(s => Math.max(1, s - 1)) }

  const save = () => {
    if (!canSave) return
    const startsAt = new Date(`${date}T${start}`).toISOString()
    const endsAt = end ? new Date(`${date}T${end}`).toISOString() : null
    onSave({
      title: title.trim(), category, instructor_id: instructorId || null,
      starts_at: startsAt, ends_at: endsAt,
      place_name: placeName.trim() || null, place_address: placeAddr.trim() || null,
      capacity: capacity ? Number(capacity) : null,
      signup_mode: signup, points: Number(points) || 0,
      description: desc.trim() || null,
    })
  }

  return (
    <Overlay onClose={onClose} title={isEdit ? '클래스 수정' : (initial ? '클래스 복사' : '클래스 추가')} wide>
      {/* 스텝 인디케이터 */}
      <div className="flex items-center justify-center gap-1.5 mb-1">
        {SESSION_STEPS.map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${step === i + 1 ? 'w-5 bg-emerald-500' : 'w-1.5 bg-gray-200'}`} />
        ))}
      </div>
      <p className="text-center text-[13px] font-semibold text-gray-500 mb-4">{step}. {SESSION_STEPS[step - 1]}</p>

      {/* 단계 콘텐츠 — 각 단계가 한 화면에 맞아 스크롤 없음 (min-h 로 푸터 흔들림 방지) */}
      <div className="min-h-[210px]">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={step} custom={dir} variants={stepSlide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: 'easeOut' }}>
            {step === 1 && (
              <>
                <Field label="클래스 제목 *"><input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 하타 요가 · 코어 안정화" autoFocus /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="종목"><CategorySelect value={category} onChange={setCategory} /></Field>
                  <Field label="강사">
                    <select className={inputCls} value={instructorId} onChange={e => setInstructorId(e.target.value)}>
                      <option value="">미지정</option>
                      {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </Field>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <Field label="날짜 *"><input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="시작 *"><input type="time" className={inputCls} value={start} onChange={e => setStart(e.target.value)} /></Field>
                  <Field label="종료"><input type="time" className={inputCls} value={end} onChange={e => setEnd(e.target.value)} /></Field>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <Field label="장소명"><input className={inputCls} value={placeName} onChange={e => setPlaceName(e.target.value)} placeholder="예: 스튜디오 A (2층)" /></Field>
                <Field label="주소"><input className={inputCls} value={placeAddr} onChange={e => setPlaceAddr(e.target.value)} placeholder="예: 서울 강남구 …" /></Field>
              </>
            )}
            {step === 4 && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="신청 방식">
                    <select className={inputCls} value={signup} onChange={e => setSignup(e.target.value)}>
                      <option value="rsvp">사전 신청(정원)</option>
                      <option value="open">자유 참여</option>
                    </select>
                  </Field>
                  <Field label="정원">
                    <input type="number" min="1" className={inputCls} value={capacity} onChange={e => setCapacity(e.target.value)} placeholder={signup === 'open' ? '무제한' : '예: 12'} disabled={signup === 'open'} />
                  </Field>
                </div>
                <Field label="출석 포인트">
                  <div className="flex items-center gap-2">
                    <div className="w-1/2"><input type="number" min="0" className={`${inputCls} text-center`} value={points} onChange={e => setPoints(e.target.value)} placeholder="0" /></div>
                    <span className="text-sm font-semibold text-gray-500">P</span>
                  </div>
                </Field>
              </>
            )}
            {step === 5 && (
              <Field label="안내 · 준비물"><textarea className={`${inputCls} h-28 py-2 resize-none`} value={desc} onChange={e => setDesc(e.target.value)} placeholder="예: 개인 매트, 편한 복장" /></Field>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 푸터 — 취소/이전 · 다음/저장 */}
      <div className="flex gap-2 mt-4">
        <button type="button" onClick={step === 1 ? onClose : goPrev} disabled={busy}
          className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition disabled:opacity-50">
          {step === 1 ? '취소' : '이전'}
        </button>
        {step < TOTAL ? (
          <button type="button" onClick={goNext} disabled={!stepValid(step)}
            className="flex-[1.6] h-11 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm font-bold transition disabled:opacity-50">
            다음
          </button>
        ) : (
          <button type="button" onClick={save} disabled={!canSave || busy}
            className="flex-[1.6] h-11 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm font-bold transition disabled:opacity-50">
            {busy ? '저장 중...' : (isEdit ? '수정 저장' : '저장')}
          </button>
        )}
      </div>
    </Overlay>
  )
}

function Overlay({ title, children, onClose, wide }) {
  useBodyScrollLock(true)  // 마운트=열림 → iOS 배경 스크롤 방지
  const kbInset = useKeyboardInset()   // iOS 키보드 높이 — 클래스/강사 편집 입력 시 카드 위로
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/45" style={{ paddingBottom: kbInset ? kbInset + 16 : undefined, transition: 'padding-bottom .2s ease' }} onClick={onClose}>
      <div className={`w-full ${wide ? 'max-w-md' : 'max-w-xs'} max-h-[88vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[16px] font-bold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  )
}
function FormButtons({ onClose, onSave, busy, disabled }) {
  return (
    <div className="flex gap-2 pt-1">
      <button type="button" onClick={onClose} disabled={busy} className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold disabled:opacity-50">취소</button>
      <button type="button" onClick={onSave} disabled={busy || disabled} className="flex-[1.4] h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition disabled:opacity-50">
        {busy ? '저장 중...' : '저장'}
      </button>
    </div>
  )
}

export default function ClassManageView({
  instructors = [], sessions = [], busy = false,
  onCreateInstructor, onUpdateInstructor, onDeleteInstructor,
  onCreateSession, onUpdateSession, onDeleteSession,
  renderRoster = null,   // (session, onClose) => ReactNode — 출석부 모달(운영자)
}) {
  const [instrForm, setInstrForm] = useState(null)   // { } (new) | instructor (edit) | null
  const [sessForm, setSessForm] = useState(null)     // { } (new) | session (edit) | null
  const [confirm, setConfirm] = useState(null)       // { kind:'instr'|'sess', id, name }
  const [rosterSession, setRosterSession] = useState(null)

  return (
    <div className="space-y-4">
      {/* ── 강사 프로필 ── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-[15px] font-bold text-gray-800">강사</h3>
          <span className="text-[12px] text-gray-400">{instructors.length}명</span>
          <button type="button" onClick={() => setInstrForm({})}
            className="ml-auto inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-emerald-50 text-emerald-600 text-[12px] font-bold hover:bg-emerald-100 transition">
            <Plus className="w-4 h-4" /> 강사 추가
          </button>
        </div>
        {instructors.length === 0 ? (
          <p className="text-[13px] text-gray-400 py-4 text-center bg-gray-50 rounded-xl">등록된 강사가 없어요. 먼저 강사를 추가해주세요.</p>
        ) : (
          <div className="space-y-2">
            {instructors.map(i => (
              <div key={i.id} className="flex items-center gap-3 rounded-xl bg-white border border-gray-100 shadow-soft p-3">
                {instrPhotoUrl(i.photo_path)
                  ? <img src={instrPhotoUrl(i.photo_path)} alt="" loading="lazy" decoding="async" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  : <span className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center flex-shrink-0">{(i.name || '?')[0]}</span>}
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-gray-900 truncate">{i.name}</p>
                  <p className="text-[12px] text-gray-500 truncate">{i.specialty || '전문 미입력'}</p>
                </div>
                <button type="button" onClick={() => setInstrForm(i)} className="p-1.5 text-gray-400 hover:text-emerald-600"><Pencil className="w-4 h-4" /></button>
                <button type="button" onClick={() => setConfirm({ kind: 'instr', id: i.id, name: i.name })} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 클래스 ── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-[15px] font-bold text-gray-800">클래스</h3>
          <span className="text-[12px] text-gray-400">{sessions.length}개</span>
          <button type="button" onClick={() => setSessForm({})} disabled={instructors.length === 0}
            className="ml-auto inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-emerald-500 text-white text-[12px] font-bold hover:bg-emerald-600 transition disabled:opacity-40"
            title={instructors.length === 0 ? '강사를 먼저 추가해주세요' : ''}>
            <Plus className="w-4 h-4" /> 클래스 추가
          </button>
        </div>
        {sessions.length === 0 ? (
          <p className="text-[13px] text-gray-400 py-4 text-center bg-gray-50 rounded-xl">등록된 클래스가 없어요.</p>
        ) : (
          <div className="space-y-2.5">
            {sessions.map(s => {
              const c = catOf(s.category)
              return (
                <div key={s.id} className="rounded-2xl bg-white border border-gray-100 shadow-soft p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`inline-flex items-center gap-1 pl-1 pr-2 h-6 rounded-lg text-[11px] font-bold ${c.pill}`}>{c.icon ? <img src={c.icon} alt="" aria-hidden="true" className="w-4 h-4 object-contain" /> : c.emoji} {c.label}</span>
                    <span className="text-[11px] text-gray-400">{s.signup_mode === 'rsvp' ? '사전 신청' : '자유 참여'}</span>
                    <button type="button" onClick={() => setSessForm(s)} className="ml-auto p-1 text-gray-300 hover:text-emerald-600" title="수정"><Pencil className="w-4 h-4" /></button>
                    <button type="button" onClick={() => setSessForm({ ...s, id: undefined, _copy: true, title: `${s.title} (사본)` })} className="p-1 text-gray-300 hover:text-emerald-600" title="복사"><Copy className="w-4 h-4" /></button>
                    <button type="button" onClick={() => setConfirm({ kind: 'sess', id: s.id, name: s.title })} className="p-1 text-gray-300 hover:text-red-500" title="삭제"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <p className="text-[15px] font-bold text-gray-900 mb-1.5">{s.title}</p>
                  <div className="space-y-1 text-[12px] text-gray-500">
                    <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gray-400" />{dLabel(s.starts_at)} {tLabel(s.starts_at)}{s.ends_at ? `~${tLabel(s.ends_at)}` : ''}</p>
                    {s.place_name && <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" />{s.place_name}</p>}
                    <p className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-gray-400" />{s.instructor?.name || '강사 미지정'} · 신청 {s.joined ?? 0}{s.capacity ? `/${s.capacity}` : ''}명{s.points ? ` · +${s.points}P` : ''}</p>
                  </div>
                  {renderRoster && (
                    <button type="button" onClick={() => setRosterSession(s)}
                      className="mt-3 w-full h-9 rounded-xl bg-gray-50 text-gray-600 text-[12px] font-bold hover:bg-gray-100 transition">
                      출석부
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {instrForm && (
        <InstructorForm
          initial={instrForm.id ? instrForm : null}
          busy={busy}
          onClose={() => setInstrForm(null)}
          onSave={(payload) => {
            if (instrForm.id) onUpdateInstructor?.(instrForm.id, payload)
            else onCreateInstructor?.(payload)
            setInstrForm(null)
          }}
        />
      )}
      {sessForm && (
        <SessionForm
          instructors={instructors}
          initial={(sessForm.id || sessForm._copy) ? sessForm : null}
          isEdit={!!sessForm.id}
          busy={busy}
          onClose={() => setSessForm(null)}
          onSave={(payload) => {
            if (sessForm.id) onUpdateSession?.(sessForm.id, payload)
            else onCreateSession?.(payload)   // 복사(_copy)는 id 없음 → 새 클래스로 생성
            setSessForm(null)
          }}
        />
      )}

      {rosterSession && renderRoster?.(rosterSession, () => setRosterSession(null))}

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm.kind === 'instr') onDeleteInstructor?.(confirm.id)
          else onDeleteSession?.(confirm.id)
          setConfirm(null)
        }}
        title={confirm?.kind === 'instr' ? '강사 삭제' : '클래스 삭제'}
        message={confirm ? `"${confirm.name}"을(를) 삭제할까요?` : ''}
        confirmLabel="삭제"
        danger
        busy={busy}
      />
    </div>
  )
}
