import { useState } from 'react'
import { ChevronLeft, X, Check } from 'lucide-react'
import ClassManageView from '../components/program/ClassManageView'

// 데모용 출석부(로컬 토글)
function DemoRoster({ session, onClose }) {
  const [roster, setRoster] = useState([
    { user_id: 'u1', nickname: '햇살', on: true },
    { user_id: 'u2', nickname: '초록이', on: false },
    { user_id: 'u3', nickname: '민트', on: true },
    { user_id: 'u4', nickname: '바다', on: false },
  ])
  const present = roster.filter(r => r.on).length
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/45" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[16px] font-bold text-gray-900">출석부</h3>
          <button type="button" onClick={onClose} className="text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-[12px] text-gray-500 mb-3 truncate">{session.title} · 출석 <b className="text-emerald-600">{present}</b>/{roster.length}명</p>
        <ul className="divide-y divide-gray-50">
          {roster.map(r => (
            <li key={r.user_id} className="flex items-center gap-2.5 py-2.5">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center justify-center">{r.nickname[0]}</span>
              <span className="flex-1 text-[14px] font-medium text-gray-800">{r.nickname}</span>
              <button type="button" onClick={() => setRoster(a => a.map(x => x.user_id === r.user_id ? { ...x, on: !x.on } : x))}
                className={`inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12px] font-bold transition ${r.on ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {r.on ? <><Check className="w-3.5 h-3.5" /> 출석</> : '미출석'}
              </button>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-gray-400 mt-3">출석 체크 시 참가자에게 클래스 포인트가 부여돼요.</p>
      </div>
    </div>
  )
}

// 데모 — 운영자 「클래스 관리」(강사 CRUD + 클래스 생성/목록). /class-manage-demo
//   실쿼리 대신 로컬 상태. UI·폼 검토용.
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d }
const iso = (d, h, m) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x.toISOString() }

export default function ClassManageDemoPage() {
  const [instructors, setInstructors] = useState([
    { id: 'i1', name: '김서연', specialty: '요가 지도자 · 8년', bio: '' },
    { id: 'i2', name: '박준호', specialty: '크로스핏 L2 코치', bio: '' },
  ])
  const [sessions, setSessions] = useState([
    { id: 's1', title: '하타 요가 · 코어 안정화', category: 'yoga', instructor_id: 'i1', instructor: { name: '김서연' }, starts_at: iso(addDays(2), 19, 0), ends_at: iso(addDays(2), 20, 0), place_name: '스튜디오 A (2층)', capacity: 12, joined: 8, signup_mode: 'rsvp', points: 20 },
    { id: 's2', title: '크로스핏 입문 WOD', category: 'crossfit', instructor_id: 'i2', instructor: { name: '박준호' }, starts_at: iso(addDays(4), 20, 0), ends_at: iso(addDays(4), 21, 0), place_name: '짐 B', capacity: 10, joined: 6, signup_mode: 'rsvp', points: 30 },
  ])
  let seq = 100
  const uid = () => `x${seq++}`

  return (
    <div className="min-h-screen bg-gray-50 py-3">
      <div className="max-w-[430px] mx-auto px-[11px]">
        <div className="h-[44px] flex items-center justify-center relative mb-3">
          <ChevronLeft className="absolute left-1 w-5 h-5 text-gray-600" />
          <span className="text-[15px] font-bold text-gray-800">클래스 관리</span>
        </div>
        <ClassManageView
          instructors={instructors}
          sessions={sessions}
          onCreateInstructor={(p) => setInstructors(a => [...a, { id: uid(), ...p }])}
          onUpdateInstructor={(id, patch) => setInstructors(a => a.map(i => i.id === id ? { ...i, ...patch } : i))}
          onDeleteInstructor={(id) => setInstructors(a => a.filter(i => i.id !== id))}
          onCreateSession={(p) => setSessions(a => [...a, { id: uid(), joined: 0, ...p, instructor: { name: instructors.find(i => i.id === p.instructor_id)?.name || '미지정' } }])}
          onUpdateSession={(id, patch) => setSessions(a => a.map(s => s.id === id ? { ...s, ...patch, instructor: { name: instructors.find(i => i.id === patch.instructor_id)?.name || s.instructor?.name || '미지정' } } : s))}
          onDeleteSession={(id) => setSessions(a => a.filter(s => s.id !== id))}
          renderRoster={(session, onClose) => <DemoRoster session={session} onClose={onClose} />}
        />
      </div>
    </div>
  )
}
