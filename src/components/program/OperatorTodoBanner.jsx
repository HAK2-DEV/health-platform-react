import { motion } from 'framer-motion'

// 운영자 「할 일」 배너 — 참여 승인·인증 심사·퀴즈 채점 대기를 한 곳에.
//   흩어지고 숨어 있던 세 대기열을 통합해, 운영자 미처리로 프로그램이 멈추는 걸 막는다. 0인 항목은 숨김.
//   props: approve, review, grade (각 대기 수), onApprove/onReview/onGrade (바로가기)
export default function OperatorTodoBanner({ approve = 0, review = 0, grade = 0, report = 0, onApprove, onReview, onGrade, onReport }) {
  const items = [
    approve > 0 ? { key: 'approve', label: '참여 승인', short: '승인', count: approve, onClick: onApprove } : null,
    review > 0 ? { key: 'review', label: '인증 심사', short: '심사', count: review, onClick: onReview } : null,
    grade > 0 ? { key: 'grade', label: '퀴즈 채점', short: '채점', count: grade, onClick: onGrade } : null,
    report > 0 ? { key: 'report', label: '신고 처리', short: '신고', count: report, onClick: onReport } : null,
  ].filter(Boolean)
  if (!items.length) return null
  const total = approve + review + grade + report
  const compact = items.length >= 4   // 4개면 짧은 라벨로 한 줄에 맞춤
  return (
    <motion.div initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, boxShadow: ['0 0 0px rgba(251,191,36,0)', '0 0 16px 2px rgba(251,191,36,0.55)', '0 0 0px rgba(251,191,36,0)'] }}
      transition={{ opacity: { duration: 0.35 }, y: { duration: 0.35 }, boxShadow: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } }}
      className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[15px]">🔔</span>
        <p className="text-[13px] font-extrabold text-amber-900">처리할 일 {total}건</p>
        <span className="ml-auto text-[11px] text-amber-700/70 break-keep">지금 처리하면 프로그램이 원활해요</span>
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it) => (
          <button key={it.key} type="button" onClick={it.onClick}
            className="flex items-center justify-center gap-1 h-9 px-1.5 rounded-xl bg-white border border-amber-200 text-amber-800 text-[13px] font-bold active:scale-[0.98] transition">
            <span className="truncate">{compact ? it.short : it.label}</span>
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10.5px] font-bold tabular-nums flex-shrink-0">{it.count}</span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}
