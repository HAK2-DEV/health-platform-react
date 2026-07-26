import { Check } from 'lucide-react'
import { catOf } from '../../lib/classCategories'
import { formatKstStamp } from '../../lib/formatters'

// 유저 클래스 목록 — 신청·출석한 세션별 상태·적립 포인트. 운영자·참가자 화면 공용.
//   classes: fetchUserClassDetail 결과
const ATT_LABEL = { confirmed: '출석', pending: '승인 대기', rejected: '미인정' }

export default function UserClassList({ classes }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
      {classes.map(c => {
        const cat = catOf(c.category)
        const confirmed = c.att?.status === 'confirmed'
        const attTxt = c.att ? (ATT_LABEL[c.att.status] || c.att.status)
          : (c.reg === 'registered' ? '신청함' : c.reg === 'cancelled' ? '신청 취소' : '미참여')
        return (
          <div key={c.id} className="flex items-center gap-3 p-4">
            {cat.icon
              ? <img src={cat.icon} alt="" aria-hidden="true" loading="lazy" className="w-9 h-9 object-contain flex-shrink-0" />
              : <span className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">{cat.emoji}</span>}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate">{c.title}</p>
              <p className="text-[12px] text-gray-400 mt-0.5 truncate">
                {c.starts_at ? formatKstStamp(c.starts_at) : ''}{c.instructor ? ` · ${c.instructor} 강사` : ''}
              </p>
            </div>
            <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
              <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${confirmed ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                {confirmed && <Check className="w-3 h-3" />}{attTxt}
              </span>
              {c.earned > 0 && <span className="text-[12px] font-bold text-emerald-600">+{c.earned}P</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
