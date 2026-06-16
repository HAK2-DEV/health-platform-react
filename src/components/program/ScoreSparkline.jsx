import { TrendingUp } from 'lucide-react'

// 14일 점수 추세 스파크라인 — SVG polyline + 마지막 점 강조.
// 모든 점수 0 이면 일직선 (max=1 로 가드). series 비어있으면 호출 측에서 렌더 가드.
function ScoreSparkline({ series }) {
  const w = 88
  const h = 32
  const max = Math.max(1, ...series.map(s => s.point))
  const stepX = series.length > 1 ? w / (series.length - 1) : w
  const pointsStr = series.map((s, i) => {
    const x = i * stepX
    const y = h - (s.point / max) * h
    return `${x},${y}`
  }).join(' ')
  const last = series[series.length - 1]
  const lastX = (series.length - 1) * stepX
  const lastY = h - ((last?.point || 0) / max) * h
  const total14d = series.reduce((sum, s) => sum + s.point, 0)
  return (
    <div className="flex flex-col items-end flex-shrink-0">
      <div className="flex items-center gap-0.5 text-xs text-emerald-700 mb-0.5">
        <TrendingUp className="w-3 h-3" />
        <span>14일 +{total14d}P</span>
      </div>
      <svg width={w} height={h} className="overflow-visible">
        <polyline
          points={pointsStr}
          fill="none"
          stroke="rgb(16, 185, 129)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={lastX} cy={lastY} r="2.5" fill="rgb(16, 185, 129)" />
      </svg>
    </div>
  )
}

export default ScoreSparkline
