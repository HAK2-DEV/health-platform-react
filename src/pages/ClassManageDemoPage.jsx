import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import ClassManageView from '../components/program/ClassManageView'

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
        />
      </div>
    </div>
  )
}
