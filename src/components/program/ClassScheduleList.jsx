import { useQuery } from '@tanstack/react-query'
import { Calendar, MapPin, Users, ChevronRight } from 'lucide-react'
import { fetchSessions, fetchMyRegistrations, formatKstDate } from '../../lib/queries'
import { catOf } from '../../lib/classCategories'

// 참가자 「클래스 일정」 전체 목록 — 다가오는 클래스를 주별로. (신청·상세는 후속 단계)
const WD = ['일', '월', '화', '수', '목', '금', '토']
const dLabel = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})` }
const tLabel = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const DAY = 24 * 3600 * 1000

function SessionCard({ s, mine, onOpen }) {
  const c = catOf(s.category)
  return (
    <button type="button" onClick={onOpen} className="w-full text-left rounded-2xl bg-white border border-gray-100 shadow-soft p-3.5 hover:bg-gray-50/60 transition">
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center gap-1 pl-1 pr-2 h-6 rounded-lg text-[11px] font-bold ${c.pill}`}>{c.icon ? <img src={c.icon} alt="" aria-hidden="true" className="w-4 h-4 object-contain" /> : c.emoji} {c.label}</span>
        {mine && <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">신청됨</span>}
        <span className="text-[11px] text-gray-400 ml-auto">{s.signup_mode === 'rsvp' ? '사전 신청' : '자유 참여'}</span>
        <ChevronRight className="w-4 h-4 text-gray-300 -mr-1" />
      </div>
      <p className="text-[15px] font-bold text-gray-900 mb-1.5">{s.title}</p>
      <div className="space-y-1 text-[12px] text-gray-500">
        <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gray-400" />{dLabel(s.starts_at)} {tLabel(s.starts_at)}{s.ends_at ? `~${tLabel(s.ends_at)}` : ''}</p>
        {s.place_name && <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" />{s.place_name}</p>}
        <p className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-gray-400" />{s.instructor?.name || '강사 미지정'} 강사 · 신청 {s.joined ?? 0}{s.capacity ? `/${s.capacity}` : ''}명{s.points ? ` · +${s.points}P` : ''}</p>
      </div>
    </button>
  )
}

export default function ClassScheduleList({ programId, userId, onOpenSession = () => {} }) {
  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', programId], queryFn: () => fetchSessions(programId), enabled: !!programId,
  })
  const { data: myRegs = {} } = useQuery({
    queryKey: ['my-registrations', programId, userId], queryFn: () => fetchMyRegistrations({ programId, userId }), enabled: !!programId && !!userId,
  })
  const now = Date.now()
  const todayKst = formatKstDate(new Date())
  const upcoming = sessions.filter(s => formatKstDate(new Date(s.starts_at)) >= todayKst)
  const groups = [
    { label: '이번 주', items: upcoming.filter(s => new Date(s.starts_at).getTime() <= now + 7 * DAY) },
    { label: '다음 주', items: upcoming.filter(s => { const t = new Date(s.starts_at).getTime(); return t > now + 7 * DAY && t <= now + 14 * DAY }) },
    { label: '이후', items: upcoming.filter(s => new Date(s.starts_at).getTime() > now + 14 * DAY) },
  ].filter(g => g.items.length > 0)

  if (upcoming.length === 0) {
    return <p className="text-[13px] text-gray-500 py-16 text-center">예정된 클래스가 없어요.</p>
  }
  return (
    <div className="space-y-3">
      {groups.map(g => (
        <div key={g.label}>
          <p className="text-[12px] font-bold text-gray-400 mb-2 px-0.5">{g.label}</p>
          <div className="space-y-2.5">
            {g.items.map(s => <SessionCard key={s.id} s={s} mine={myRegs[s.id] === 'registered'} onOpen={() => onOpenSession(s.id)} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
