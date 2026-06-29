import { Heart } from 'lucide-react'
import { quitRecovery } from '../../lib/quitRecovery'

// 금연 회복 단계 카드 — 연속 금연일 기준 현재 회복 마일스톤 + 다음 단계까지.
//   금연 테마 개요에 노출. props: streak(연속 금연 일수)
function QuitRecoveryCard({ streak = 0 }) {
  const rec = quitRecovery(streak)
  return (
    <div className="bg-white rounded-2xl shadow-elevated p-4 mb-[9px]">
      <div className="flex items-center gap-2 mb-2">
        <Heart className="w-4 h-4 text-rose-400 fill-current" />
        <h3 className="text-sm font-bold text-gray-800">금연 회복 단계</h3>
        <span className="text-[11px] text-gray-400 ml-auto">{rec.stage}/{rec.total}단계 · 연속 {streak}일</span>
      </div>
      <p className="text-[15px] font-extrabold text-emerald-700">{rec.title}</p>
      <p className="text-[12px] text-gray-600 mt-0.5 leading-snug break-keep">{rec.desc}</p>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2.5">
        <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${(rec.stage / rec.total) * 100}%` }} />
      </div>
      {rec.next && (
        <p className="text-[11px] text-gray-400 mt-1.5">다음 「{rec.next.title}」까지 {rec.daysToNext}일</p>
      )}
    </div>
  )
}

export default QuitRecoveryCard
