import { useState } from 'react'
import { Plus, Calendar, MapPin, Users, Pencil, Trash2, X } from 'lucide-react'
import { CLASS_CAT_LIST, catOf } from '../../lib/classCategories'
import ConfirmModal from '../common/ConfirmModal'

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

// ── 강사 폼 모달 ──
function InstructorForm({ initial, onSave, onClose, busy }) {
  const [name, setName] = useState(initial?.name || '')
  const [specialty, setSpecialty] = useState(initial?.specialty || '')
  const [bio, setBio] = useState(initial?.bio || '')
  const save = () => { if (!name.trim()) return; onSave({ name: name.trim(), specialty: specialty.trim() || null, bio: bio.trim() || null }) }
  return (
    <Overlay onClose={onClose} title={initial ? '강사 수정' : '강사 추가'}>
      <Field label="이름 *"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="예: 김서연" /></Field>
      <Field label="전문 · 경력"><input className={inputCls} value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="예: 요가 지도자 · 8년" /></Field>
      <Field label="소개"><textarea className={`${inputCls} h-20 py-2 resize-none`} value={bio} onChange={e => setBio(e.target.value)} placeholder="강사 소개를 적어주세요" /></Field>
      <FormButtons onClose={onClose} onSave={save} busy={busy} disabled={!name.trim()} />
    </Overlay>
  )
}

// ── 클래스 폼 모달 (신규/편집) ──
const pad2 = (n) => String(n).padStart(2, '0')
const toDateInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
const toTimeInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }
function SessionForm({ instructors, initial, onSave, onClose, busy }) {
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

  const valid = title.trim() && date && start
  const save = () => {
    if (!valid) return
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
    <Overlay onClose={onClose} title={initial ? '클래스 수정' : '클래스 추가'} wide>
      <Field label="클래스 제목 *"><input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 하타 요가 · 코어 안정화" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="종목">
          <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>
            {CLASS_CAT_LIST.map(c => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
          </select>
        </Field>
        <Field label="강사">
          <select className={inputCls} value={instructorId} onChange={e => setInstructorId(e.target.value)}>
            <option value="">미지정</option>
            {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="날짜 *"><input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="시작 *"><input type="time" className={inputCls} value={start} onChange={e => setStart(e.target.value)} /></Field>
        <Field label="종료"><input type="time" className={inputCls} value={end} onChange={e => setEnd(e.target.value)} /></Field>
      </div>
      <Field label="장소명"><input className={inputCls} value={placeName} onChange={e => setPlaceName(e.target.value)} placeholder="예: 스튜디오 A (2층)" /></Field>
      <Field label="주소"><input className={inputCls} value={placeAddr} onChange={e => setPlaceAddr(e.target.value)} placeholder="예: 서울 강남구 …" /></Field>
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
      <Field label="출석 포인트"><input type="number" min="0" className={inputCls} value={points} onChange={e => setPoints(e.target.value)} placeholder="0" /></Field>
      <Field label="안내 · 준비물"><textarea className={`${inputCls} h-16 py-2 resize-none`} value={desc} onChange={e => setDesc(e.target.value)} placeholder="예: 개인 매트, 편한 복장" /></Field>
      <FormButtons onClose={onClose} onSave={save} busy={busy} disabled={!valid} />
    </Overlay>
  )
}

function Overlay({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/45" onClick={onClose}>
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
}) {
  const [instrForm, setInstrForm] = useState(null)   // { } (new) | instructor (edit) | null
  const [sessForm, setSessForm] = useState(null)     // { } (new) | session (edit) | null
  const [confirm, setConfirm] = useState(null)       // { kind:'instr'|'sess', id, name }

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
                <span className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center flex-shrink-0">{(i.name || '?')[0]}</span>
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
                    <span className={`inline-flex items-center gap-1 px-2 h-6 rounded-lg text-[11px] font-bold ${c.pill}`}>{c.emoji} {c.label}</span>
                    <span className="text-[11px] text-gray-400">{s.signup_mode === 'rsvp' ? '사전 신청' : '자유 참여'}</span>
                    <button type="button" onClick={() => setSessForm(s)} className="ml-auto p-1 text-gray-300 hover:text-emerald-600"><Pencil className="w-4 h-4" /></button>
                    <button type="button" onClick={() => setConfirm({ kind: 'sess', id: s.id, name: s.title })} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <p className="text-[15px] font-bold text-gray-900 mb-1.5">{s.title}</p>
                  <div className="space-y-1 text-[12px] text-gray-500">
                    <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gray-400" />{dLabel(s.starts_at)} {tLabel(s.starts_at)}{s.ends_at ? `~${tLabel(s.ends_at)}` : ''}</p>
                    {s.place_name && <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" />{s.place_name}</p>}
                    <p className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-gray-400" />{s.instructor?.name || '강사 미지정'} · 신청 {s.joined ?? 0}{s.capacity ? `/${s.capacity}` : ''}명{s.points ? ` · +${s.points}P` : ''}</p>
                  </div>
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
          initial={sessForm.id ? sessForm : null}
          busy={busy}
          onClose={() => setSessForm(null)}
          onSave={(payload) => {
            if (sessForm.id) onUpdateSession?.(sessForm.id, payload)
            else onCreateSession?.(payload)
            setSessForm(null)
          }}
        />
      )}

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
