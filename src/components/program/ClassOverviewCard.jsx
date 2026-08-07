import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { fetchSessions, formatKstDate } from '../../lib/queries'
import { catOf } from '../../lib/classCategories'
import { countNew } from '../../lib/newContent'

// 개요 진입 카드 — 다가오는 클래스 2건 미리보기 + 「전체 보기」. class_feature_enabled 일 때만.
//   card-home 카드와 폭 맞춤(w-[398px] mx-auto). 다가오는 일정 없으면 안내 1줄.
const WD = ['일', '월', '화', '수', '목', '금', '토']
const dLabel = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})` }
const tLabel = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

export default function ClassOverviewCard({ programId, joinedAt = null, onOpenAll = () => {} }) {
  const { data: sessions = [], isLoading: isSessLoading } = useQuery({
    queryKey: ['sessions', programId], queryFn: () => fetchSessions(programId), enabled: !!programId,
  })
  // 오늘(KST) 이후 클래스 — 오늘 클래스는 시작 시각이 지나도 하루 종일 노출
  const todayKst = formatKstDate(new Date())
  const upcoming = sessions.filter(s => formatKstDate(new Date(s.starts_at)) >= todayKst)
  const weekEnd = Date.now() + 7 * 24 * 3600 * 1000
  const thisWeek = upcoming.filter(s => new Date(s.starts_at).getTime() <= weekEnd).length
  const preview = upcoming.slice(0, 2)
  // 새 클래스 — 마지막 열람(없으면 참여 시각) 이후 생성분. 클래스 목록 열면(markSeen) 사라짐.
  const newCount = countNew(sessions, programId, 'classes', joinedAt)

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4 mb-[9px] mx-auto w-[398px] max-w-full">
      <button type="button" onClick={onOpenAll} className="w-full flex items-center gap-2 mb-3 text-left">
        <img src="/icons/feature/attendance.png" alt="" aria-hidden="true" className="w-6 h-6 object-contain" />
        <h3 className="text-sm font-bold text-gray-800">클래스 일정</h3>
        {newCount > 0 && <span className="px-1.5 py-[1px] rounded-full bg-red-500 text-white text-[9px] font-extrabold tracking-wide">NEW</span>}
        {thisWeek > 0 && <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">이번 주 {thisWeek}</span>}
        <span className="ml-auto inline-flex items-center text-[12px] text-gray-400">전체 보기 <ChevronRight className="w-4 h-4" /></span>
      </button>
      {isSessLoading ? (
        <p className="text-[13px] text-gray-300 py-2 text-center">불러오는 중…</p>
      ) : preview.length === 0 ? (
        <p className="text-[13px] text-gray-400 py-2 text-center">예정된 클래스가 없어요.</p>
      ) : (
        <div className="space-y-2">
          {preview.map(s => {
            const c = catOf(s.category)
            return (
              <button key={s.id} type="button" onClick={onOpenAll} className="w-full flex items-center gap-3 rounded-xl bg-gray-50 p-2.5 text-left hover:bg-gray-100 transition">
                <span className={`inline-flex items-center gap-1 pl-1 pr-2 h-6 rounded-lg text-[11px] font-bold flex-shrink-0 ${c.pill}`}>{c.icon ? <img src={c.icon} alt="" aria-hidden="true" className="w-4 h-4 object-contain" /> : c.emoji} {c.label}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-gray-800 truncate">{s.title}</p>
                  <p className="text-[11px] text-gray-500 truncate">{dLabel(s.starts_at)} · {tLabel(s.starts_at)} · {s.instructor?.name || '강사'} 강사</p>
                </div>
                <span className="text-[11px] text-gray-400 flex-shrink-0">{s.joined ?? 0}{s.capacity ? `/${s.capacity}` : ''}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
