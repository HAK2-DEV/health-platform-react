// 「활동 구성」 레이더 — 프로그램에서 참여자가 할 수 있는 활동만 축으로.
//   미션 인증(항상) + 퀴즈(퀴즈 있음) + 게시글·댓글·좋아요(커뮤니티 있음).
//   시간 추이가 아니라 "무엇을 얼마나 하는지" 스냅샷. 축이 3개 미만이면 의미 없어 렌더 안 함.
export default function ActivityRadarChart({ data = {}, quizEnabled = false, communityEnabled = true }) {
  const AXES = [
    { key: 'mission', label: '인증', emoji: '✅', on: true },
    { key: 'quiz', label: '퀴즈', emoji: '🧠', on: quizEnabled },
    { key: 'post', label: '게시글', emoji: '📝', on: communityEnabled },
    { key: 'comment', label: '댓글', emoji: '💬', on: communityEnabled },
    { key: 'like', label: '좋아요', emoji: '❤️', on: communityEnabled },
  ].filter((a) => a.on)
  const n = AXES.length
  if (n < 3) return null   // 축 2개 이하면 레이더가 아니라 의미 없음

  const vals = AXES.map((a) => Math.max(0, data[a.key] || 0))
  const total = vals.reduce((s, v) => s + v, 0)
  const maxV = Math.max(1, ...vals)

  const W = 260, H = 210, cx = W / 2, cy = H / 2 + 4, R = 68
  const ang = (i) => (-90 + i * (360 / n)) * Math.PI / 180
  const pt = (i, r) => [cx + R * r * Math.cos(ang(i)), cy + R * r * Math.sin(ang(i))]
  const poly = (rOf) => AXES.map((_, i) => { const [x, y] = pt(i, rOf(i)); return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}` }).join(' ') + ' Z'

  const rings = [0.25, 0.5, 0.75, 1]
  const dataPath = poly((i) => vals[i] / maxV)

  return (
    <div className="flex flex-col items-center w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[240px]" role="img" aria-label="활동 구성 레이더">
        {rings.map((r) => <path key={r} d={poly(() => r)} fill="none" stroke="#eef1f0" strokeWidth="1" />)}
        {AXES.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#eef1f0" strokeWidth="1" /> })}
        {total > 0 && <path d={dataPath} fill="rgba(16,185,129,0.20)" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />}
        {AXES.map((a, i) => { const [x, y] = pt(i, vals[i] / maxV); return vals[i] > 0 ? <circle key={a.key} cx={x} cy={y} r="3" fill="#10b981" /> : null })}
        {AXES.map((a, i) => {
          const [lx, ly] = pt(i, 1.26)
          const c = Math.cos(ang(i))
          const anchor = c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle'
          return (
            <g key={a.key}>
              <text x={lx} y={ly - 4} textAnchor={anchor} style={{ fontSize: 11, fontWeight: 700, fill: '#6b7280' }}>{a.emoji} {a.label}</text>
              <text x={lx} y={ly + 9} textAnchor={anchor} style={{ fontSize: 11, fontWeight: 800, fill: '#059669' }}>{vals[i]}건</text>
            </g>
          )
        })}
      </svg>
      {total === 0 && <p className="text-[12px] text-gray-400 -mt-2">아직 활동이 없어요. 인증·응원으로 시작해볼까요?</p>}
    </div>
  )
}
