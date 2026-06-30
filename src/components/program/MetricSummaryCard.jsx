// 주요 기록 요약 카드 — 다중 지표(거리/시간/칼로리 등) 합산 + 최근 7일 증감 + 총 달성 횟수.
//   개요(본인) / 운영자 참여자 상세(해당 유저) 공용. props:
//     summary: fetchMyMetricSummary 결과 { metrics:[{key,label,icon,unit,sumUnit,divide,format,total,recent}], count, recentCount }
//     title: 카드 안 제목 (기본 '주요 기록 요약'). null 이면 제목 숨김(상위에서 섹션 헤딩 사용).
//     variant: 'overview'(개요, rounded-2xl shadow-elevated) | 'stats'(통계화면, border rounded-[10px])
//   데이터 없으면 null 렌더.
function MetricSummaryCard({ summary, title = '주요 기록 요약', variant = 'overview' }) {
  if (!summary || !(summary.metrics?.length > 0 || summary.count > 0)) return null
  const cardCls = variant === 'stats'
    ? 'bg-white border border-gray-200 rounded-[10px] p-4 mb-[9px]'
    : 'bg-white rounded-2xl shadow-elevated p-4 mb-[9px]'

  const fmt = (n) => Number(n || 0).toLocaleString('ko-KR', { maximumFractionDigits: 1 })
  // 시:분 (H:MM) — 저장값(분) → "8:36"
  const hm = (mins) => { const h = Math.floor(mins / 60); const mm = Math.round(mins % 60); return `${h}:${String(mm).padStart(2, '0')}` }
  const disp = (m, raw) => {
    if (m.format === 'hm') return { value: hm(raw), unit: '' }
    if (m.divide > 1) return { value: fmt(raw / m.divide), unit: m.sumUnit || m.unit }
    return { value: fmt(raw), unit: m.sumUnit || m.unit }
  }
  const cells = [
    ...summary.metrics.map(m => {
      const d = disp(m, m.total), r = disp(m, m.recent)
      return { icon: m.icon || '📊', label: `총 ${m.label}`, value: d.value, unit: d.unit, recent: m.recent, rvalue: r.value, runit: r.unit }
    }),
    { icon: '🏃', label: '총 달성 횟수', value: fmt(summary.count), unit: '회', recent: summary.recentCount, rvalue: fmt(summary.recentCount), runit: '회' },
  ]

  return (
    <div className={cardCls}>
      {title && <h3 className="text-sm font-bold text-gray-800 mb-3">{title}</h3>}
      <div className="flex overflow-x-auto scrollbar-hide -mx-1 px-1">
        {cells.map((c, i) => (
          <div key={i} className={`flex-1 min-w-[72px] flex flex-col items-center text-center px-2 ${i !== 0 ? 'border-l border-gray-100' : ''}`}>
            <span className="text-xl mb-1 leading-none">{c.icon}</span>
            <span className="text-[10px] text-gray-500 mb-0.5 leading-tight truncate max-w-full">{c.label}</span>
            <span className="text-[15px] font-bold text-gray-800 leading-tight truncate max-w-full">{c.value}<span className="text-[10px] font-medium text-gray-400 ml-0.5">{c.unit}</span></span>
            {c.recent > 0 && (
              <span className="mt-0.5 text-[10px] font-semibold text-emerald-500 truncate max-w-full">↑{c.rvalue}{c.runit}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default MetricSummaryCard
